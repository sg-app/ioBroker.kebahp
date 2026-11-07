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
var datapoints_exports = {};
__export(datapoints_exports, {
  buildStateSignature: () => buildStateSignature,
  isValidCommonType: () => isValidCommonType,
  isValidDatapoint: () => isValidDatapoint,
  parseDatapoints: () => parseDatapoints
});
module.exports = __toCommonJS(datapoints_exports);
const SUPPORTED_TYPES = ["number", "boolean", "string"];
function isValidDatapoint(value) {
  return typeof value === "object" && value !== null && typeof value.name === "string" && value.name.length > 0;
}
function parseDatapoints(data) {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isValidDatapoint);
}
function isValidCommonType(type) {
  return typeof type === "string" && SUPPORTED_TYPES.includes(type);
}
function buildStateSignature(object) {
  const common = object.common;
  return JSON.stringify([common.name, common.role, common.type, common.unit, common.read, common.write]);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildStateSignature,
  isValidCommonType,
  isValidDatapoint,
  parseDatapoints
});
//# sourceMappingURL=datapoints.js.map
