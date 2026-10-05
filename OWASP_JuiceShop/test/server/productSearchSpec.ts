import request from 'supertest'
import { expect } from 'chai'

describe('Products API - Search Integration Tests', () => {
  let token: string

  before(async () => {
    const loginResponse = await request('http://localhost:3000')
      .post('/rest/user/login')
      .send({
        email: 'admin@juice-sh.op',
        password: 'admin123'
      })
    token = loginResponse.body.authentication.token
  })

  it('should search products with valid query', (done) => {
    request('http://localhost:3000')
      .get('/rest/products/search?q=apple')
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.data).to.be.an('array')
        done()
      })
  })

  it('should return all products when search query is empty', (done) => {
    request('http://localhost:3000')
      .get('/rest/products/search?q=')
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.data).to.be.an('array')
        expect(res.body.data.length).to.be.greaterThan(0)
        done()
      })
  })

  it('should return empty array for no matching products', (done) => {
    request('http://localhost:3000')
      .get('/rest/products/search?q=xyzabc123nonexistent')
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.data).to.be.an('array')
        expect(res.body.data.length).to.equal(0)
        done()
      })
  })

  it('should handle special characters in search query', (done) => {
    request('http://localhost:3000')
      .get('/rest/products/search?q=juice%20%26%20smoothie')
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.data).to.be.an('array')
        done()
      })
  })

  it('should get product by ID', (done) => {
    request('http://localhost:3000')
      .get('/api/Products/1')
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.data).to.have.property('id', 1)
        expect(res.body.data).to.have.property('name')
        expect(res.body.data).to.have.property('price')
        done()
      })
  })

  it('should return 404 for non-existent product ID', (done) => {
    request('http://localhost:3000')
      .get('/api/Products/99999')
      .end((err: any, res: any) => {
        expect(res.status).to.equal(404)
        done()
      })
  })
})