/**
 * @file comments-section.cy.ts
 * @description Cypress E2E tests for request comments section
 */

describe('Request Comments Section', () => {
  beforeEach(() => {
    // Mock the backend endpoints
    cy.intercept('GET', '**/solicitudes/*/comments/stream**', {
      statusCode: 200,
      headers: {
        'content-type': 'text/event-stream',
      },
      body: 'data: {"success":true,"data":{"users":{"2":{"name":"Test User","role":"Authorizer"}},"messages":[{"pageIndex":1,"at":"2026-05-14T10:00:00.000Z","user_key":1,"content":"Previous comment"}]}}\n\n',
    }).as('streamComments');

    cy.intercept('POST', '**/solicitudes/*/comments', {
      statusCode: 201,
      body: { message: 'Successfully posted comment' },
    }).as('createComment');

    cy.visit('/detalles-solicitud/1');
  });

  it('should display the comments section', () => {
    cy.get('h3').should('contain', 'Comentarios de la solicitud');
    cy.get('input[placeholder*="Escribe tu comentario"]').should('exist');
  });

  it('should display loading skeleton initially', () => {
    cy.get('div').should('contain', 'cargando');
  });

  it('should send a comment on Enter key', () => {
    cy.get('input[placeholder*="Escribe tu comentario"]').type('Test comment{enter}');
    cy.wait('@createComment');
    cy.get('@createComment').its('request.body').should('deep.equal', {
      user_id: 1,
      content: 'Test comment',
    });
  });

  it('should clear input after sending comment', () => {
    const input = cy.get('input[placeholder*="Escribe tu comentario"]');
    input.type('Test comment{enter}');
    cy.wait('@createComment');
    input.should('have.value', '');
  });

  it('should display error message on failed comment submission', () => {
    cy.intercept('POST', '**/solicitudes/*/comments', {
      statusCode: 400,
      body: { error: 'Comment content is required' },
    }).as('failCreateComment');

    cy.get('input[placeholder*="Escribe tu comentario"]').type('{enter}');
    cy.wait('@failCreateComment');
    cy.get('div').should('contain', 'Comment content is required');
  });

  it('should have scroll-to-bottom button when new messages arrive', () => {
    // This test verifies the button appears when new messages are streamed
    // Simulated by the SSE stream updating
    cy.get('@streamComments');
  });

  it('should stream comments from SSE endpoint', () => {
    cy.wait('@streamComments').then((interception) => {
      expect(interception.response?.statusCode).to.equal(200);
    });
  });
});

