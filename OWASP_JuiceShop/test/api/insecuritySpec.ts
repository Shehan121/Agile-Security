

import * as insecurity from '../../lib/insecurity'
import crypto from "node:crypto"

describe("insecurity unit test", () => {

  describe("hash test", () => {

    test("generate hash() test", () => {

      const test_value = insecurity.hash("testvalue")

      expect(test_value).toBe(
        'e9de89b0a5e9ad6efd5e5ab543ec617c'
      )

    })

    test("generate hash with different value",()=>{
       const value1=insecurity.hash("test1")
       const value2=insecurity.hash("test2")
       expect(value1).not.toBe(value2)
        })
     test("generate hash with same value",()=>{
           const value1=insecurity.hash("test1")
           const value2=insecurity.hash("test1")
           expect(value1).toBe(value2)
            })
  })

   describe("hmac() test",()=>{
       test("generate hmac value",()=>{
          const expected=crypto.createHmac( "sha256","pa4qacea4VK9t9nGv7yZtwmj")
              .update("testvalue").digest("hex")

              const test_value=insecurity.hmac("testvalue")
              expect(test_value).toBe(expected)  })

     test ("generate hmac with different value",()=>{
       const test1=insecurity.hmac("value1")
       const test2=insecurity.hmac("value2")
       expect(test1).not.toBe(test2)
         })
     test("generate hmac with same value",()=>{
         const test1=insecurity.hmac("value")
         const test2=insecurity.hmac("value")
         expect(test1).toBe(test2)  })
       })

   describe("cutOffPoisonNullByte test",()=>{
      test("remove poison null byte",()=>{
        const test=insecurity.cutOffPoisonNullByte("test.png%00.exe")
          expect(test).toBe("test.png")})
      test("keep normal string unchanged",()=>{
          const test=insecurity.cutOffPoisonNullByte("test.png")
          expect(test).toBe("test.png") })
       })

   describe("authenticatedUsers test",()=>{
    test("store and retrive user test",()=>{
        const token="token976"
     const testuser={
       data:{
           id:976,
           email:"kilo@email"}
             } as any
         insecurity.authenticatedUsers.put(token,testuser)
         const result=insecurity.authenticatedUsers.get(token)
         expect(result).toEqual(testuser)

         })
    })
    describe("DiscontFromCoupon test",()=>{
    test("invelid coupon test",()=>{
      const invalidCoupon=insecurity.discountFromCoupon("invalid_coupon")
       expect(invalidCoupon).toBeUndefined()})
    })

   describe("isRedirectAllowed test",()=>{
      test("url is allowed",()=>{
       const allowedUrl=insecurity.isRedirectAllowed("https://github.com/juice-shop/juice-shop")
       expect(allowedUrl).toBeTruthy()
       })

     test("url is not allowed",()=>{
       const unallowedUrl=insecurity.isRedirectAllowed("https://www.error.com")
              expect(unallowedUrl).toBeFalsy()  })
      })

  describe("appendUserId test",()=>{
     test("append user id to request body",()=>{
      const token="token976"
      insecurity.authenticatedUsers.put(token,
          {data:{
              id:976}
              }as any)

      const req={
          headers:{
               authorization:
                        `Bearer ${token}`},
               body:{}

          }as any
       const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
          } as any
      const next=jest.fn()
      const middleware=insecurity.appendUserId()
      middleware(req, res, next)
      expect(req.body.UserId).toBe(976)
      expect(next).toHaveBeenCalled()
     })
    test("wrong path for appending user id to request body",()=>{

      const req={
          headers:{
               authorization:
                        `Bearer invalid_token`},
               body:{}

          }as any
       const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
          } as any
      const next=jest.fn()
      const middleware=insecurity.appendUserId()
      middleware(req,res,next)
      expect(res.status).toHaveBeenCalledWith(401)
        })
})
describe("isAccounting test", () => {

  test("should reject non-accounting user", () => {

    const middleware =
      insecurity.isAccounting()

    const req = {
      headers: {}
    } as any

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as any

    const next = jest.fn()

    middleware(req, res, next)

    expect(res.status)
      .toHaveBeenCalledWith(403)

  })

})

})