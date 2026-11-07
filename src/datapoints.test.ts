import { expect } from 'chai';
import { buildStateSignature, isValidCommonType, isValidDatapoint, parseDatapoints } from './datapoints';

describe('lib/datapoints', () => {
    describe('isValidDatapoint', () => {
        it('accepts objects with a non empty name', () => {
            expect(isValidDatapoint({ name: 'APPL.x', value: 1 })).to.equal(true);
        });

        it('rejects invalid values', () => {
            expect(isValidDatapoint(null)).to.equal(false);
            expect(isValidDatapoint('x')).to.equal(false);
            expect(isValidDatapoint({})).to.equal(false);
            expect(isValidDatapoint({ name: '' })).to.equal(false);
            expect(isValidDatapoint({ name: 42 })).to.equal(false);
        });
    });

    describe('parseDatapoints', () => {
        it('returns an empty array for non array responses', () => {
            expect(parseDatapoints(null)).to.deep.equal([]);
            expect(parseDatapoints({})).to.deep.equal([]);
            expect(parseDatapoints('<html>')).to.deep.equal([]);
        });

        it('drops invalid entries', () => {
            const result = parseDatapoints([{ name: 'a', value: 1 }, null, { value: 2 }, { name: 'b', value: 3 }]);
            expect(result).to.have.length(2);
            expect(result.map(d => d.name)).to.deep.equal(['a', 'b']);
        });
    });

    describe('isValidCommonType', () => {
        it('accepts supported types', () => {
            expect(isValidCommonType('number')).to.equal(true);
            expect(isValidCommonType('boolean')).to.equal(true);
            expect(isValidCommonType('string')).to.equal(true);
        });

        it('rejects unsupported types', () => {
            expect(isValidCommonType('object')).to.equal(false);
            expect(isValidCommonType('')).to.equal(false);
            expect(isValidCommonType(undefined)).to.equal(false);
        });
    });

    describe('buildStateSignature', () => {
        const build = (unit: string): Pick<ioBroker.StateObject, 'common'> => ({
            common: { name: 'a', role: 'value', type: 'number', unit, read: true, write: false },
        });

        it('changes when a managed property changes', () => {
            expect(buildStateSignature(build('°C'))).to.not.equal(buildStateSignature(build('K')));
        });

        it('is stable for identical properties', () => {
            expect(buildStateSignature(build('°C'))).to.equal(buildStateSignature(build('°C')));
        });
    });
});
