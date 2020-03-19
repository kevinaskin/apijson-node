import { Request, Response } from "express";
import Axios from 'axios'
import sha1hex = require('sha1-hex')
import { HttpStatus } from "@nestjs/common";

class MiddlewareQueue {
  private taskList: string[]
  private req: any
  private res: any
  private next: any

  constructor (
    middlewareList: string[],
    req: Request,
    res: Response,
    next: Function
  ) {
    this.taskList = middlewareList
    this.next = next
    this.req = req
    this.res = res
  }

  execTaskList () {
    if (!this.taskList.length) {
      this.next()
      return
    }
    const task = this.taskList.shift()
    new Promise((resolve, reject) => {
      try {
        (async (req, res, next, tool) => {
          eval(`(
            ${task}
          )(req, res, next, tool)`)
        })(this.req, this.res, resolve, {
          Axios,
          sha1hex,
          // ...
          // some other tool instance here
        })
      } catch (e) {
        console.log(e)
        this.res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR
        this.res.send('出错了')
        reject(e)
      }
    }).then(() => {
      if (this.taskList.length) {
        this.execTaskList()
      } else {
        this.next()
      }
    })
  }
}

export default MiddlewareQueue