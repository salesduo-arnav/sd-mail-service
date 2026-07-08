import fs from 'fs';
import path from 'path';
import { openapiSpec } from './spec';

// Writes the spec to docs/openapi.json for publishing / client generation.
const out = path.resolve(__dirname, '../../../docs/openapi.json');
fs.writeFileSync(out, JSON.stringify(openapiSpec, null, 2));
console.log(`OpenAPI written to ${out}`);
