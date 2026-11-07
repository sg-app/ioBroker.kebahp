import { expect } from 'chai';
import { parseValue, roundToTwoDecimals } from './utils';

describe('lib/utils', () => {
    describe('parseValue', () => {
        it('converts numeric strings to numbers', () => {
            expect(parseValue('42')).to.equal(42);
            expect(parseValue('3.14')).to.equal(3.14);
            expect(parseValue('-7')).to.equal(-7);
        });

        it('converts boolean strings to booleans', () => {
            expect(parseValue('true')).to.equal(true);
            expect(parseValue('false')).to.equal(false);
        });

        it('keeps non numeric strings unchanged', () => {
            expect(parseValue('hello')).to.equal('hello');
            expect(parseValue('')).to.equal('');
            expect(parseValue('   ')).to.equal('   ');
        });

        it('keeps non string values unchanged', () => {
            expect(parseValue(42)).to.equal(42);
            expect(parseValue(true)).to.equal(true);
            expect(parseValue(null)).to.equal(null);
        });
    });

    describe('roundToTwoDecimals', () => {
        it('rounds to two decimal places', () => {
            expect(roundToTwoDecimals(1.2345)).to.equal(1.23);
            expect(roundToTwoDecimals(1.2355)).to.equal(1.24);
            expect(roundToTwoDecimals(2)).to.equal(2);
        });
    });
});
