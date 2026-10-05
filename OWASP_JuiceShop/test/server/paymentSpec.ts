import request from 'supertest'
import { expect } from 'chai'

describe('Payment Methods - Integration Tests', () => {
  let token: string
  let userId: number
  let cardId: number

  before(async () => {
    // Login to get authentication token
    const loginResponse = await request('http://localhost:3000')
      .post('/rest/user/login')
      .send({
        email: 'admin@juice-sh.op',
        password: 'admin123'
      })
    token = loginResponse.body.authentication.token
    userId = 1
  })

  // Successfully get all payment methods (cards)
  it('should get all payment methods successfully', (done) => {
    request('http://localhost:3000')
      .get('/api/Cards')
      .set('Authorization', `Bearer ${token}`)
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.status).to.equal('success')
        expect(res.body.data).to.be.an('array')
        done()
      })
  })

  // Successfully add a new payment method - API returns 201 Created
  it('should add a new payment method successfully', (done) => {
    const newCard = {
      UserId: userId,
      fullName: 'CI Test User',
      cardNum: '4111111111111111',
      expMonth: 12,
      expYear: 2099
    }

    request('http://localhost:3000')
      .post('/api/Cards')
      .set('Authorization', `Bearer ${token}`)
      .send(newCard)
      .end((err: any, res: any) => {
        console.log('Add card status:', res.status)
        console.log('Add card body:', res.body)

        // API returns 201 for successful creation
        expect(res.status).to.equal(201)
        expect(res.body.status).to.equal('success')
        expect(res.body.data).to.have.property('id')
        cardId = res.body.data.id
        done()
      })
  })

  // Successfully get card by ID
  it('should get card by ID successfully', (done) => {
    if (!cardId) {
      return done(new Error('No card created - previous test failed'))
    }

    request('http://localhost:3000')
      .get(`/api/Cards/${cardId}`)
      .set('Authorization', `Bearer ${token}`)
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.data.id).to.equal(cardId)
        expect(res.body.data.cardNum).to.include('*') // Masked card number
        done()
      })
  })

  // Successfully delete card by ID
  it('should delete card successfully', (done) => {
    if (!cardId) {
      return done(new Error('No card created - previous test failed'))
    }

    request('http://localhost:3000')
      .delete(`/api/Cards/${cardId}`)
      .set('Authorization', `Bearer ${token}`)
      .end((err: any, res: any) => {
        expect(res.status).to.equal(200)
        expect(res.body.status).to.equal('success')
        done()
      })
  })

  // Failed scenarios
  it('should fail to get cards - missing authentication', (done) => {
    request('http://localhost:3000')
      .get('/api/Cards')
      .end((err: any, res: any) => {
        expect(res.status).to.equal(401)
        done()
      })
  })

  it('should fail to get cards - invalid token', (done) => {
    request('http://localhost:3000')
      .get('/api/Cards')
      .set('Authorization', 'Bearer invalid-token-12345')
      .end((err: any, res: any) => {
        expect(res.status).to.equal(401)
        done()
      })
  })

  // Add card with expired year (should fail validation)
  it('should fail to add card - expired year', (done) => {
    const newCard = {
      UserId: userId,
      fullName: 'Test User',
      cardNum: '4111111111111111',
      expMonth: 12,
      expYear: 2020  // Expired year
    }

    request('http://localhost:3000')
      .post('/api/Cards')
      .set('Authorization', `Bearer ${token}`)
      .send(newCard)
      .end((err: any, res: any) => {
        expect(res.status).to.equal(400)
        expect(res.body.message).to.include('Validation')
        done()
      })
  })

  // Add card with invalid month
  it('should fail to add card - invalid month', (done) => {
    const newCard = {
      UserId: userId,
      fullName: 'Test User',
      cardNum: '4111111111111111',
      expMonth: 13,  // Invalid month (1-12 only)
      expYear: 2099
    }

    request('http://localhost:3000')
      .post('/api/Cards')
      .set('Authorization', `Bearer ${token}`)
      .send(newCard)
      .end((err: any, res: any) => {
        expect(res.status).to.equal(400)
        done()
      })
  })

  // Add card with month 0 (invalid)
  it('should fail to add card - month zero', (done) => {
    const newCard = {
      UserId: userId,
      fullName: 'Test User',
      cardNum: '4111111111111111',
      expMonth: 0,
      expYear: 2099
    }

    request('http://localhost:3000')
      .post('/api/Cards')
      .set('Authorization', `Bearer ${token}`)
      .send(newCard)
      .end((err: any, res: any) => {
        expect(res.status).to.equal(400)
        done()
      })
  })

  // Get non-existent card ID
  it('should return 400 for non-existent card ID', (done) => {
    request('http://localhost:3000')
      .get('/api/Cards/99999')
      .set('Authorization', `Bearer ${token}`)
      .end((err: any, res: any) => {
        expect(res.status).to.equal(400)
        done()
      })
  })

  // Delete non-existent card ID
  it('should return 400 when deleting non-existent card', (done) => {
    request('http://localhost:3000')
      .delete('/api/Cards/99999')
      .set('Authorization', `Bearer ${token}`)
      .end((err: any, res: any) => {
        expect(res.status).to.equal(400)
        done()
      })
  })

  // Add card without authentication
  it('should fail to add card without authentication', (done) => {
    const newCard = {
      UserId: userId,
      fullName: 'Test User',
      cardNum: '4111111111111111',
      expMonth: 12,
      expYear: 2099
    }

    request('http://localhost:3000')
      .post('/api/Cards')
      .send(newCard)
      .end((err: any, res: any) => {
        expect(res.status).to.equal(401)
        done()
      })
  })

  // Try to access card from different user (IDOR test)
  it('should fail to access card from different user', async () => {
    // First create a card for user 1
    const newCard = {
      UserId: userId,
      fullName: 'Original User',
      cardNum: '4111111111111111',
      expMonth: 12,
      expYear: 2099
    }

    const createRes = await request('http://localhost:3000')
      .post('/api/Cards')
      .set('Authorization', `Bearer ${token}`)
      .send(newCard)

    // Skip if card creation failed
    if (!createRes.body.data || !createRes.body.data.id) {
      console.log('Could not create test card, skipping IDOR test')
      return
    }

    const createdCardId = createRes.body.data.id

    // Register a new user
    const registerRes = await request('http://localhost:3000')
      .post('/api/Users')
      .send({
        email: `test_user_${Date.now()}@juice-sh.op`,
        password: 'Test123!@#',
        passwordRepeat: 'Test123!@#',
        securityQuestion: 1,
        securityAnswer: 'Answer'
      })

    const otherUserEmail = registerRes.body.data.email

    const otherLogin = await request('http://localhost:3000')
      .post('/rest/user/login')
      .send({
        email: otherUserEmail,
        password: 'Test123!@#'
      })

    const otherToken = otherLogin.body.authentication.token

    // Try to access the card created by user 1
    const accessRes = await request('http://localhost:3000')
      .get(`/api/Cards/${createdCardId}`)
      .set('Authorization', `Bearer ${otherToken}`)

    // Should fail - cannot access other user's card
    expect(accessRes.status).to.equal(400)

    // Clean up - delete the card created by user 1
    await request('http://localhost:3000')
      .delete(`/api/Cards/${createdCardId}`)
      .set('Authorization', `Bearer ${token}`)
  })
})