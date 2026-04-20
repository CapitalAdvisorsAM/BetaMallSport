function extractMappedName(blockBody, fallbackName) {
  const mapMatch = blockBody.match(/@@map\("([^"]+)"\)/);
  return mapMatch ? mapMatch[1] : fallbackName;
}

function parseFields(blockBody, tableName) {
  const lines = blockBody.split(/\r?\n/);
  const fields = [];
  const deprecatedFields = [];
  let pendingDocLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pendingDocLines = [];
      continue;
    }

    if (line.startsWith("///")) {
      pendingDocLines.push(line.replace(/^\/\/\/\s?/, ""));
      continue;
    }

    if (line.startsWith("//")) {
      continue;
    }

    if (line.startsWith("@@")) {
      pendingDocLines = [];
      continue;
    }

    const tokens = line.split(/\s+/);
    if (tokens.length < 2) {
      pendingDocLines = [];
      continue;
    }

    const fieldName = tokens[0];
    const dbNameMatch = line.match(/@map\("([^"]+)"\)/);
    const columnName = dbNameMatch ? dbNameMatch[1] : fieldName;
    const documentation = pendingDocLines.join(" ").trim();

    const field = {
      fieldName,
      columnName,
      documentation
    };

    fields.push(field);

    if (documentation.toLowerCase().includes("@deprecated")) {
      deprecatedFields.push({
        tableName,
        fieldName,
        columnName,
        documentation
      });
    }

    pendingDocLines = [];
  }

  return { fields, deprecatedFields };
}

export function parsePrismaSchema(schemaText) {
  const models = [];
  const enums = [];
  const deprecatedFields = [];
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  const enumRegex = /enum\s+(\w+)\s*\{([\s\S]*?)\n\}/g;

  let modelMatch;
  while ((modelMatch = modelRegex.exec(schemaText)) !== null) {
    const [, modelName, body] = modelMatch;
    const tableName = extractMappedName(body, modelName);
    const { fields, deprecatedFields: blockDeprecatedFields } = parseFields(body, tableName);

    models.push({
      modelName,
      tableName,
      fields
    });
    deprecatedFields.push(...blockDeprecatedFields);
  }

  let enumMatch;
  while ((enumMatch = enumRegex.exec(schemaText)) !== null) {
    const [, enumName, body] = enumMatch;
    enums.push({
      enumName,
      dbName: extractMappedName(body, enumName)
    });
  }

  return {
    models,
    enums,
    deprecatedFields
  };
}

export function parseManualIndexes(sqlText) {
  const names = [];
  const regex = /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+NOT\s+EXISTS)?\s+"([^"]+)"/gi;

  let match;
  while ((match = regex.exec(sqlText)) !== null) {
    names.push(match[1]);
  }

  return names;
}
