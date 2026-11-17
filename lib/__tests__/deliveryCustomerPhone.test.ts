import assert from 'node:assert/strict';
import { customerPhoneLimit, formatCustomerPhone, parseCustomerPhoneInput } from '../deliveryCustomerPhone';

for (const spelling of ['33123456', '+973 3312 3456', '00973-33123456', '97333123456', '٣٣١٢٣٤٥٦', '۳۳۱۲۳۴۵۶']) {
  const parsed = parseCustomerPhoneInput(spelling, '973');
  assert.ok(parsed, spelling);
  assert.equal(formatCustomerPhone(parsed.code, parsed.number), '+97333123456');
}

assert.equal(customerPhoneLimit('973'), 8);
assert.equal(formatCustomerPhone('973', '3312345'), null);
assert.equal(parseCustomerPhoneInput('+973331234567', '973'), null);
assert.equal(parseCustomerPhoneInput('331234567', '973'), null);
assert.equal(parseCustomerPhoneInput('33123456 ext 9', '973'), null);
assert.deepEqual(parseCustomerPhoneInput('+971 501234567', '971'), { code: '971', number: '501234567' });
assert.equal(formatCustomerPhone('971', '501234567'), '+971501234567');
console.log('Customers Log phone normalization passed.');
