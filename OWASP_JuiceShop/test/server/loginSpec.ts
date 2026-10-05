import request from 'supertest'
import { expect } from 'chai'

describe('login integration test', () => {

  it('should login successfully', async () => {

    const response =
      await request('http://localhost:3000')
        .post('/rest/user/login')
        .send({
          email: 'admin@juice-sh.op',
          password: 'admin123'
        })

    expect(response.status)
      .to.equal(200)

  })
it('should reject invalid login', (done) => {
  request('http://localhost:3000')
    .post('/rest/user/login')
    .send({
      email: 'admin@juice-sh.op',
      password: 'wrongpassword'
    })
    .expect(401)
    .end((err, res) => {
      if (err) return done(err)

      expect(res.body.authentication).to.equal(undefined)
      expect(res.body.data).to.be.undefined

      done()
    })
})

})