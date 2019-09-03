// parser, handler here for json body transfer to ORM executor
import { RequestParser, JobInterface, StatusEnum } from './traverse'

interface jsonBodyParserReturn {
  queue: JobInterface[],
  errors: string[],
  originalJson: any,
  RequestParser: RequestParser
}

const POOL_SIZE: number = 5 // for current-limiting 
const RequestParserPool: RequestParser[] = []

export function jsonBodyParser (queryBody: object): jsonBodyParserReturn {
  if (RequestParserPool.length < POOL_SIZE) {
    const RPInstance = new RequestParser(queryBody)
    RequestParserPool.push(RPInstance)
    return {
      queue: RPInstance.queue.slice(),
      errors: RPInstance.errors.slice(),
      originalJson: queryBody,
      RequestParser: RPInstance
    }
  } else {
    const RPInstance = getFreeRequestParser(RequestParserPool)
    if (RPInstance) {
      RPInstance.startJob(queryBody)
      return {
        queue: RPInstance.queue.slice(),
        errors: RPInstance.errors.slice(),
        originalJson: queryBody,
        RequestParser: RPInstance
      }
    } else {
      return null
    }
  }
}

function getFreeRequestParser (pool: RequestParser[]): RequestParser | null {
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].status === StatusEnum.Free) {
      pool[i].flushJob()
      return pool[i]
    }
  }
  return null
}