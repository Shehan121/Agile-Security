
import * as utils from '../../lib/utils'
import fs from 'node:fs'
import download from 'download'
import logger from '../../lib/logger'

jest.mock('download')
jest.mock('node:fs')
jest.mock('../../lib/logger')

describe("utils test",()=>{
    describe("queryResultToJson test",()=>{
    test("convert query to json test",()=>{
    const queryresult={id:976,email:"kilo@test.com"}
    const test=utils.queryResultToJson(queryresult)
    expect(test.data).toEqual({id:976,email:"kilo@test.com"})
    expect(test.status).toBe("success")
        })

    test("convert define status query to json test ",()=>{
      const queryresult={id:976,email:"kilo@test.com"}
         const test=utils.queryResultToJson(queryresult,"failed")
         expect(test.status).toBe("failed")
         })
    })

   describe("isUrl test",()=>{
       test("start with http",()=>{
         const url="http//:www.test.com"
                const result=utils.isUrl(url)
                expect(result).toBeTruthy()  })
       test("not start with http",()=>{
            const url="www.test.com"
            const result=utils.isUrl(url)
            expect(result).toBeFalsy()  })


       })
     describe("containsEscaped test",()=>{
      test("escape //",()=>{
      const result=utils.containsEscaped("//kilo//","ki")
      expect(result).toBeTruthy()
          })

      test("do not contain",()=>{
            const result=utils.containsEscaped("//kilo##","helios")
            expect(result).toBeFalsy()
                })
      })

   describe("containsOrEscaped test",()=>{
   test("contain or escape",()=>{
    const result=utils.containsOrEscaped("//kilo##","kilo")
       expect(result).toBeTruthy()})
   })

   describe("unquote test",()=>{
      test("is a quote",()=>{
      const quote="\"This is a test\""
      const result=utils.unquote(quote)
      expect(result).toBe("This is a test")
      })

       test("is not a quote",()=>{
            const quote="This is a test"
            const result=utils.unquote(quote)
            expect(result).toBe("This is a test")
            })
        })

   describe("trunc test",()=>{
     test("show substring",()=>{
     const str="\r This is a test"
            const num=4
          const result=utils.trunc(str,num)
          expect(result).toBe(" Th...")      })

     test("show complete string",()=>{
          const str="\ntest"
          const num=4
          const result=utils.trunc(str,num)
         expect(result).toBe("test")      })
       })

   describe("toMMMYY test",()=>{
     const dateinput=new Date("2015-07-10")
     const result=utils.toMMMYY(dateinput)
     expect(result).toBe("JUL15")
     })

   describe("toISO8601 test",()=>{
   test("month,day lenth <2",()=>{
   const dateinput=new Date("2015-07-01")
   const result=utils.toISO8601(dateinput)
   expect(result).toBe("2015-07-01")})

   test("month,day lenth>2",()=>{
   const dateinput=new Date("2019-12-31")
      const result=utils.toISO8601(dateinput)
      expect(result).toBe("2019-12-31")    })
   })

   describe("extractFilename test",()=>{
    test("extract file name without ?",()=>{
    const url="http://www.test/kilo.jpeg"
    const result=utils.extractFilename(url)
    expect(result).toBe("kilo.jpeg")})

    test("extract file name with ?",()=>{
        const url="http://www.test/kilo.jpeg?size=midium"
        const result=utils.extractFilename(url)
        expect(result).toBe("kilo.jpeg")})
        })

  describe("downloadToFile test",()=>{
      test("download and save file",async()=>{
           ;(download as jest.Mock)
                .mockResolvedValue("test-data")

              await utils.downloadToFile(
                "https://test.com/file.txt",
                "file.txt")
          expect(download).toHaveBeenCalledWith("https://test.com/file.txt")
          expect(fs.writeFileSync).toHaveBeenCalled()
          })

      test("should handle download failure", async () => {

        ;(download as jest.Mock)
          .mockRejectedValue(
            new Error("download failed"))

        await utils.downloadToFile(
          "https://test.com/file.txt",
          "file.txt")

        expect(logger.warn)
          .toHaveBeenCalled()
      })
      })

  describe("jwtFrom test",()=>{
  test("extract jwt token",()=>{
  const req={
      headers:{
      authorization:"Bearer token976" } }as any
  const result=utils.jwtFrom(req)
  expect(result).toBe("token976")} )

   test("error input",()=>{
    const req={
        headers:{
        authorization:"Basic token976" } }as any
    const result=utils.jwtFrom(req)
    expect(result).toBeUndefined()})
  })

describe("getChallengeEnablementStatus test",()=>{
  test("enable challenge without disabledEnv", () => {
  const challenge={} as any
  const result=utils.getChallengeEnablementStatus(challenge)
  expect(result.enabled).toBeTruthy()
  expect(result.disabledBecause).toBeNull()})

  test("enable challenge when safety mode disabled", () => {
    const challenge={disabledEnv:["Docker"]} as any
    const result=utils.getChallengeEnablementStatus(challenge,"disabled")
    expect(result.enabled).toBeTruthy()
   })

  test("disable challenge in docker", () => {
      const challenge={disabledEnv:["Docker"]} as any
      const result=utils.getChallengeEnablementStatus(challenge,"auto",{
           isDocker:()=>true,
           isHeroku:()=> false,
           isWindows:()=>false,
           isGitpod:()=>false})
      expect(result.enabled).toBeFalsy()
      expect(result.disabledBecause).toBe("Docker")
     })
   test("disable challenge in Heroku", () => {
         const challenge={disabledEnv:["Heroku"]} as any
         const result=utils.getChallengeEnablementStatus(challenge,"auto",{
              isDocker:()=>false,
              isHeroku:()=> true,
              isWindows:()=>false,
              isGitpod:()=>false})
         expect(result.enabled).toBeFalsy()
         expect(result.disabledBecause).toBe("Heroku")
        })
    test("disable challenge in windows", () => {
          const challenge={disabledEnv:["Windows"]} as any
          const result=utils.getChallengeEnablementStatus(challenge,"auto",{
               isDocker:()=>false,
               isHeroku:()=> false,
               isWindows:()=>true,
               isGitpod:()=>false})
          expect(result.enabled).toBeFalsy()
          expect(result.disabledBecause).toBe("Windows")
         })

     test("disable challenge in Gitpod", () => {
           const challenge={disabledEnv:["Gitpod"]} as any
           const result=utils.getChallengeEnablementStatus(challenge,"auto",{
                isDocker:()=>true,
                isHeroku:()=> false,
                isWindows:()=>false,
                isGitpod:()=>true})
           expect(result.enabled).toBeFalsy()
           expect(result.disabledBecause).toBe("Gitpod")
          })

     test("disable challenge in enabled safety mode", () => {

       const challenge = {
         disabledEnv: ["Docker"]} as any

       const result =
         utils.getChallengeEnablementStatus(
           challenge,
           "enabled",
           {
             isDocker: () => false,
             isHeroku: () => false,
             isWindows: () => false,
             isGitpod: () => false
           }
         )

       expect(result.enabled)
         .toBe(false)

       expect(result.disabledBecause)
         .toBe("Safety Mode")

     })

    test("should return true for enabled challenge", () => {

      const challenge = {} as any

      const result =
        utils.isChallengeEnabled(
          challenge
        )

      expect(result).toBeTruthy()})

  })
  describe("parseJsonCustom test", () => {
    test("should parse json string", () => {
      const json ='{"name":"admin","age":30}'
      const result =utils.parseJsonCustom(json)
      expect(result).toEqual([
        {key: "name",
          value: "admin" },
        {key: "age",
          value: 30}
      ])
    })
  })
})
