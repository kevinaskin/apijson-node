import { AppController } from './app.controller'
import { config } from '../entities/index'

describe('AppController', () => {
  let appController: AppController

  beforeEach(() => {
    appController = new AppController()
  })

  describe('health test', () => {
    it('should return string "ok"', async () => {
      expect(await appController.root()).toBe('ok')
    })
  })

  // describe('can-i-use', () => {
  //   it('should return a list of entities and description', async () => {
  //     const { TestMsg, TestUser, ...rest } = config
  //     expect(await appController.getEntity()).toMatchObject({...rest})
  //   })
  // })
})