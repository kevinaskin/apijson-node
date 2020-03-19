import { Injectable} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, getConnection } from 'typeorm'
import { ApiJsonUserEntity } from '../configEntities/user.entity'

@Injectable()
export class ApiJsonUserService {
  @InjectRepository(ApiJsonUserEntity, 'apijsonDB')
  private readonly ApiJsonUserRepository: Repository<ApiJsonUserEntity>

  async findOne(options: any = {}): Promise<any> {
    return this.ApiJsonUserRepository.findOne(options)
  }

  async find(options: any = {}): Promise<any> {
    return this.ApiJsonUserRepository.find(options)
  }

  async count(options: any = {}): Promise<any> {
    return this.ApiJsonUserRepository.count(options)
  }

  async update(id, options: any = {}): Promise<any> {
    return this.ApiJsonUserRepository.update(id, options)
  }

  async delete(options: any = {}): Promise<any> {
    return this.ApiJsonUserRepository.delete(options)
  }

  async insert(options: any = {}): Promise<any> {
    return this.ApiJsonUserRepository.insert(options)
  }
}
