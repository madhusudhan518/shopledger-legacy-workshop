'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function makeOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 42,
    date: '2026-11-21',
    status: 'completed',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: invoice GST follows the HSN slab used for billing', function () {
  // Checkout stores HSN on each line but does not store a gstRate.
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var order = makeOrder(items);
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice coupon and GST amounts match the billed order', function () {
  var items = [{ id: 2, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }];
  var order = makeOrder(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(order.discount, 5);
  assert.equal(order.tax, 17.1);
  assert.equal(order.total, 112.1);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 8.55);
  assert.equal(figures.sgst, 8.55);
  assert.equal(figures.total, order.total);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹17\.10/);
  assert.match(html, /Coupon Discount \(WELCOME\)<\/td><td class="r" style="color:#16a34a">-₹5\.00/);
});

test('CURRENT BEHAVIOUR: invoice respects the stored capped coupon discount', function () {
  var items = [{ id: 3, name: 'Coffee', sku: 'COF', hsn: '0901', price: 1500, qty: 1 }];
  var order = makeOrder(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 243);
  assert.equal(order.total, 1593);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});
