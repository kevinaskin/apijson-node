import { readFile, writeFile, exists, fstat } from 'fs'
import { resolve } from 'path'
import { Logger } from '@nestjs/common'

/**
 * 暂时用不到Redis
 * 先用内存管理一下缓存
 * 如需接入Redis
 * 可以实现 `hasKey` `getData` `setData` 三个接口即可
 */

export default class MemoryStore {
  private _store: object
  private _date: string
  private _timer: any
  
  constructor () {
    console.log(`[MemoryStore] init`)
    this._store = {}

    if (!this._timer) {
      this._timer = setInterval(() => {
        this.syncData(this._store)
      }, 60 * 1000)
    }
  }

  syncData (data) {
    this._date = new Date().toISOString().slice(0, 10)
    const PATH_SAVED = `../../db/${this._date}.json`
    exists(resolve(__dirname, PATH_SAVED), (bool) => {
      if (!bool) {
        writeFile(resolve(__dirname, PATH_SAVED), JSON.stringify(data, null, 2), (err) => {
          if (err) {
            Logger.error(`[Cache] read local db store failed (${err})`)
            return
          }
          Logger.log(`[Cache] loacl db store saved`)
        })
        return
      }
      readFile(resolve(__dirname, PATH_SAVED), (err, localData) => {
        if (err) {
          Logger.error(`[Cache] local db read failed ${err}`)
        }
        try {
          let ret = JSON.parse(localData.toString())
          ret = {
            ...ret,
            ...data
          }
          writeFile(resolve(__dirname, PATH_SAVED), JSON.stringify(ret, null, 2), (err) => {
            if (err) {
              Logger.error(`[Cache] read local db store failed (${err})`)
              return
            }
            Logger.log(`[Cache] loacl db store saved`)
          })
        } catch (e) {
          Logger.error(`[Cache] rewrite error ${e}`)
        }
      })
    })
  }

  hasKey (key: string) {
    const keys = Object.keys(this._store)
    return keys.indexOf(key) > -1
  }

  getData (key: string) {
    const keys = Object.keys(this._store)
    if (keys.indexOf(key) > -1) {
      console.log(`[MemoryStore] get "${key}"`)
      return this._store[key]
    }
  }

  setData (key: string, value: any) {
    console.log(`[MemoryStore] set "${key}": "${value}"`)
    this._store[key] = value
  }
}
