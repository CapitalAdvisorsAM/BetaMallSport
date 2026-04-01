import fs from 'fs';

const path = 'C:/Users/fguzman/Desktop/GitHub/BetaMallSport/prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf8');

// Replace all IDs with UUID native type
schema = schema.replace(/id(\s+)String(\s+)@id @default\(cuid\(\)\)/g, 'id$1String$2@id @default(uuid()) @db.Uuid');

// Replace foreign keys referencing IDs
const fks = ['proyectoId', 'localId', 'arrendatarioId', 'contratoId', 'usuarioId', 'userId'];
for (const fk of fks) {
  // Regex to match "fieldName String" or "fieldName String?" ensuring we only touch declarations
  const regex = new RegExp(`(${fk}(\\s+)String(\\??))(\\s+)`, 'g');
  schema = schema.replace(regex, '$1 @db.Uuid$4');
}

// Add indexes to Contrato
schema = schema.replace(
  /@@unique\(\[proyectoId, numeroContrato\]\)\n\}/,
  '@@unique([proyectoId, numeroContrato])\n  @@index([fechaInicio, fechaTermino])\n  @@index([proyectoId, fechaInicio, fechaTermino])\n}'
);

// Update ContratoDia relation cascade
schema = schema.replace(
  /contrato\s+Contrato\?\s+@relation\(fields: \[contratoId\], references: \[id\], onDelete: SetNull\)/,
  'contrato   Contrato?         @relation(fields: [contratoId], references: [id], onDelete: Cascade)'
);

// Add index to ContratoDia
schema = schema.replace(
  /@@unique\(\[localId, fecha\]\)\n\}/,
  '@@unique([localId, fecha])\n  @@index([proyectoId, estadoDia, fecha])\n}'
);

fs.writeFileSync(path, schema);
console.log('Modifications applied successfully.');
