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

})