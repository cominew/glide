import { Project, SyntaxKind } from "ts-morph";
import path from "path";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const skillFiles = project.addSourceFilesAtPaths("skills/**/*.ts");

for (const file of skillFiles) {
  let changed = false;

  // 1. replace 'complete' → 'emitted'
  file.forEachDescendant((node) => {
    if (node.isKind(SyntaxKind.StringLiteral) && node.getLiteralValue() === "complete") {
      node.replaceWithText("'emitted'");
      changed = true;
    }
  });

  // 2. remove `success` property from return objects
  file.forEachDescendant((node) => {
    if (node.isKind(SyntaxKind.ReturnStatement)) {
      const returnExpression = node.getExpression();
      if (returnExpression?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const obj = returnExpression.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
        const successProp = obj.getProperty("success");
        if (successProp) {
          successProp.remove();
          changed = true;
        }
      }
    }
  });

  if (changed) {
    console.log(`✔ migrated: ${path.basename(file.getFilePath())}`);
    file.saveSync();
  }
}

console.log("✅ Skill migration completed (v2)");