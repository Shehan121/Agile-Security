import request from 'supertest'
import { expect } from 'chai'

describe('order integration test', () => {

  let token: string
  let basketId: number

  before(async () => {
    // Login to get authentication token
    const loginResponse = await request('http://localhost:3000')
      .post('/rest/user/login')
      .send({
        email: 'admin@juice-sh.op',
        password: 'admin123'
      })

    token = loginResponse.body.authentication.token

    // Get basket ID
    const basketResponse = await request('http://localhost:3000')
      .get('/rest/basket/1')
      .set('Authorization', `Bearer ${token}`)

    basketId = basketResponse.body.data.id

    // Add product to basket
    await request('http://localhost:3000')
      .post('/api/BasketItems/')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ProductId: 1,
        BasketId: basketId,
        quantity: 1
      })
  })

  // Successful order placement
  it('should place order successfully', (done) => {
    request('http://localhost:3000')
      .post(`/rest/basket/${basketId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        UserId: 1
      })
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.orderConfirmation).to.exist
        done()
      })
  })

  // Failed scenarios
  it('should fail to place order - missing authentication', (done) => {
    request('http://localhost:3000')
      .post(`/rest/basket/${basketId}/checkout`)
      .send({
        UserId: 1
      })
      .end((err: any, res: any) => {
        expect(res.status).to.equal(401)
        done()
      })
  })

  it('should fail to place order - invalid token', (done) => {
    request('http://localhost:3000')
      .post(`/rest/basket/${basketId}/checkout`)
      .set('Authorization', 'Bearer invalid-token-12345')
      .send({
        UserId: 1
      })
      .end((err: any, res: any) => {
        expect(res.status).to.equal(401)
        done()
      })
  })

  it('should fail to place order - non-existent basket', (done) => {
    request('http://localhost:3000')
      .post('/rest/basket/99999/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        UserId: 1
      })
      .end((err: any, res: any) => {
        expect(res.status).to.equal(500)
        done()
      })
  })

  it('should fail to place order - empty basket', async () => {
    // Create a new empty basket
    const newBasketResponse = await request('http://localhost:3000')
      .post('/rest/basket/')
      .set('Authorization', `Bearer ${token}`)

    const emptyBasketId = newBasketResponse.body.id

    const response = await request('http://localhost:3000')
      .post(`/rest/basket/${emptyBasketId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        UserId: 1
      })

    expect(response.status).to.equal(500)
  })

  // Note: UserId, deliveryMethodId, and addressId are optional fields
  // They use default values, so these tests should expect 200 (success)
  it('should still place order successfully - missing UserId (uses default)', (done) => {
    request('http://localhost:3000')
      .post(`/rest/basket/${basketId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({})  // No UserId provided
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.orderConfirmation).to.exist
        done()
      })
  })

  it('should still place order successfully - invalid delivery method (uses default)', (done) => {
    request('http://localhost:3000')
      .post(`/rest/basket/${basketId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        UserId: 1,
        orderDetails: {
          paymentId: 'card',
          deliveryMethodId: 99999,  // Invalid but defaults to standard delivery
          addressId: 1
        }
      })
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.orderConfirmation).to.exist
        done()
      })
  })

  it('should still place order successfully - invalid address (uses default)', (done) => {
    request('http://localhost:3000')
      .post(`/rest/basket/${basketId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        UserId: 1,
        orderDetails: {
          paymentId: 'card',
          deliveryMethodId: 1,
          addressId: 99999  // Invalid but uses default
        }
      })
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.orderConfirmation).to.exist
        done()
      })
  })
  // Real failure scenario for insufficient wallet balance
  it('should fail to place order - insufficient wallet balance', async () => {
    // First, check current wallet balance
    const walletResponse = await request('http://localhost:3000')
      .get('/api/Wallets/1')
      .set('Authorization', `Bearer ${token}`)

    const currentBalance = walletResponse.body.balance || 0
    console.log(`Current wallet balance: ${currentBalance}`)

    // Add product with quantity that exceeds current balance
    // Assuming product price is around 10-20, quantity 10000 will definitely exceed
    await request('http://localhost:3000')
      .post('/api/BasketItems/')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ProductId: 1,
        BasketId: basketId,
        quantity: 10000  // Very large quantity to exceed any reasonable balance
      })

    const response = await request('http://localhost:3000')
      .post(`/rest/basket/${basketId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        UserId: 1,
        orderDetails: {
          paymentId: 'wallet',  // Use wallet payment
          deliveryMethodId: 1,
          addressId: 1
        }
      })

    expect(response.status).to.equal(500)
  })
})