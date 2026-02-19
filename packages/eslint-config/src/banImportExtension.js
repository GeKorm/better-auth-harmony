/**
 * @param {string} extension The file extension to ban
 * @returns {{ selector: string, message: string }[]} ESLint restricted syntax selectors and error message
 */
function banImportExtension(extension) {
  const message = `Unexpected use of file extension (.${extension}) in import`;
  const literalAttributeMatcher = String.raw`Literal[value=/\.${extension}$/]`;
  return [
    {
      // import foo from 'bar.js';
      selector: `ImportDeclaration > ${literalAttributeMatcher}.source`,
      message
    },
    {
      // const foo = import('bar.js');
      selector: `ImportExpression > ${literalAttributeMatcher}.source`,
      message
    },
    {
      // type Foo = typeof import('bar.js');
      selector: `TSImportType > TSLiteralType > ${literalAttributeMatcher}`,
      message
    },
    {
      // const foo = require('foo.js');
      selector: `CallExpression[callee.name = "require"] > ${literalAttributeMatcher}.arguments`,
      message
    }
  ];
}

export default banImportExtension;
