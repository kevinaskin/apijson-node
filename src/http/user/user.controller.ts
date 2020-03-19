import { Post, Controller, Get, Body, Request } from '@nestjs/common'
import { ApiUseTags, ApiBearerAuth } from '@nestjs/swagger'
import { ApiJsonUserService } from './user.service'
import { successHandler, baseHandler } from '../../helper'

@ApiBearerAuth()
@ApiUseTags('common')
@Controller('common')
export class ApiJsonUserController {
  constructor(private readonly userService: ApiJsonUserService) {}

  @Post('/user/resetPassword')
  async resetPsd(@Request() req, @Body() data): Promise<any> {
    if (!req.session.userInfo) {
      return baseHandler(403, {}, '未登录')
    }

    if (data.oldPassword === data.password) {
      return baseHandler(400, {}, '新密码不能和之前的密码一致')
    }

    const user = await this.userService.findOne({
      username: req.session.userInfo.username,
      password: data.oldPassword
    })

    if (user) {
      try {
        await this.userService.update(user.id, {
          password: data.password
        })
        return successHandler({}, '密码修改成功')
      } catch (e) {
        return baseHandler(400, {error: e}, '未知错误')
      }
    } else {
      return baseHandler(400, {}, '用户名或密码错误')
    }
  }

  @Post('/user/create')
  async addUser(@Request() req, @Body() data): Promise<any> {
    if (req.session.userInfo && req.session.userInfo.role === 'admin') {
      if (data.username && data.password && data.role && data.realName) {
        try {
          const isDuplicated = await this.userService.findOne({
            username: data.username
          })
          if (isDuplicated) {
            if (isDuplicated.isDeleted === 1) {
              await this.userService.update(isDuplicated.id, {
                ...data,
                isDeleted: 0,
                updatedAt: Date.now(),
                createdAt: Date.now(),
              })
            } else {
              return baseHandler(400, {}, '该用户已存在')
            }
          } else {
            await this.userService.insert({
              isDeleted: 0,
              updatedAt: Date.now(),
              createdAt: Date.now(),
              ...data
            })
          }
        } catch (e) {
          return baseHandler(500, {error: e}, '添加失败')
        }
        return successHandler({}, '添加成功')
      }
    }
  }

  @Post('/user/delete')
  async delUser(@Request() req, @Body() data): Promise<any> {
    if (req.session.userInfo && req.session.userInfo.role === 'admin') {
      if (data.id) {
        try {
          const userLogin = await this.userService.findOne({
            id: data.id
          })
          if (userLogin && userLogin.role !== 'admin') {
            await this.userService.update(data.id, { isDeleted: 1 })
          } else {
            return baseHandler(500, {}, '无法删除管理员用户')
          }
        } catch (e) {
          return baseHandler(500, {error: e}, '删除失败')
        }
        return successHandler({}, '删除成功')
      }
    }
  }

  @Get('/users')
  async getUsers(@Request() req): Promise<any> {
    if (req.session.userInfo && req.session.userInfo.role === 'admin') {
      const page = req.query.page || 1
      const pageSize = req.query.pageSize || 10
      const users = await this.userService.find({
        select: ['username', 'realName', 'role', 'createdAt', 'id'],
        where: { isDeleted: 0 },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
      const usersCount = await this.userService.count()
      return successHandler({
        list: users,
        totalCount: usersCount,
        page,
        pageSize
      }, '获取用户列表成功')
    } else {
      return baseHandler(403, {}, '您没有权限查看用户列表')
    }
  }

  @Get('/isLogin')
  async checkStatus(@Request() req): Promise<any> {
    if (req.session.userInfo) {
      return successHandler(req.session.userInfo, 'ok')
    } else {
      return baseHandler(403, {}, '未登录')
    }
  }

  @Get('/logout')
  async logout(@Request() req): Promise<any> {
    req.session.userInfo = undefined
    return successHandler({}, 'logout success')
  }

  @Post('/login')
  async login(@Body() data, @Request() req): Promise<any> {
    if (req.session.userInfo) {
      console.log('has session')
      return successHandler(req.session.userInfo, '已登录')
    }
    const userLogin = await this.userService.findOne({
      username: data.username,
      password: data.password
    })
    if (userLogin) {
      req.session.userInfo = {
        username: data.username,
        realName: userLogin.realName,
        role: userLogin.role,
        loginTime: Date.now()
      }
      return successHandler(req.session.userInfo, '登录成功')
    } else {
      // log out
      req.session.userInfo = undefined
      return baseHandler(-1, {}, '用户名或密码错误')
    }
  }
}