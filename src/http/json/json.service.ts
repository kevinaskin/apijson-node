import { Injectable} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { UserEntity, CommentEntity } from '../../entities'

@Injectable()
export class JsonService {
  @InjectRepository(UserEntity)
  private readonly UserRepository: Repository<UserEntity>
  @InjectRepository(CommentEntity)
  private readonly CommentRepository: Repository<CommentEntity>

  async insert(entityName: string, payload: any = {}): Promise<any> {
    const currentRepository = this[`${entityName}Repository`]

    return currentRepository && currentRepository.insert(payload)
  }

  async update(id: any, entityName: string, payload: any = {}): Promise<any> {
    const currentRepository = this[`${entityName}Repository`]
    return currentRepository && currentRepository.update(id, payload)
  }

  async findOne(entityName: string, options: any = {}): Promise<any> {
    const currentRepository = this[`${entityName}Repository`]

    return currentRepository && currentRepository.findOne(options)
  }

  async find(entityName: string, options: any = {}, listOptions: any = {
    page: 1, count: 10
  }): Promise<any[]> {
    const currentRepository = this[`${entityName}Repository`]
    const { select, ...restOptions} = options
    return currentRepository && currentRepository.find({
      where: {
        ...restOptions
      },
      select,
      skip: (listOptions.page - 1) * listOptions.count,
      take: listOptions.count
    })
  }
}
