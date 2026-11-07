"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var utils_exports = {};
__export(utils_exports, {
  normalizeValue: () => normalizeValue,
  parseValue: () => parseValue,
  roundToTwoDecimals: () => roundToTwoDecimals
});
module.exports = __toCommonJS(utils_exports);
function parseValue(value) {
  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    if (value.trim() !== "" && !isNaN(Number(value))) {
      return Number(value);
    }
  }
  return value;
}
function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}
function normalizeValue(value) {
  if (typeof value === "number" && value % 1 !== 0) {
    return roundToTwoDecimals(value);
  }
  return value;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  normalizeValue,
  parseValue,
  roundToTwoDecimals
});
//# sourceMappingURL=utils.js.map
