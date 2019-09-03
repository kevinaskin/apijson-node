export const HTTP_CODE = {
  SUCCESS: 0,
  WARNING: 10000
}

interface successFeedback {
  code: number,
  msg: string,
  data: any
}

export function successHandler(
  data: any = {},
  msg: string = 'success'
): successFeedback {
  return baseHandler(HTTP_CODE.SUCCESS, data, msg)
}

export function baseHandler (
  code: number,
  data: any = {},
  msg: string = 'success'
): successFeedback {
  return {
    code,
    data,
    msg
  }
}