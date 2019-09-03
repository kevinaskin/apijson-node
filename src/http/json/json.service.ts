import { Injectable} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { UserEntity, CommentEntity } from '../../entities'

@Injectable()
export class JsonService {
  @InjectRepository(UserEntity)
  private readonly userRepository: Repository<UserEntity>
  @InjectRepository(CommentEntity)
  private readonly commentRepository: Repository<CommentEntity>

  async findOne(entityName: string, options: any = {}): Promise<any> {
    const currentRepository = this[`${entityName.toLowerCase()}Repository`]

    return currentRepository && currentRepository.findOne(options)
  }

  async find(entityName: string, options: any = {}, listOptions: any = {
    page: 1, count: 10
  }): Promise<any[]> {
    const currentRepository = this[`${entityName.toLowerCase()}Repository`]
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
