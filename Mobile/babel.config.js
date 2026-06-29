module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      function removeFlowClassPropertyDeclarations() {
        return {
          visitor: {
            ClassProperty(path) {
              if (!path.node.value && !path.node.computed) {
                path.remove();
              }
            },
            ExpressionStatement(path) {
              const expression = path.node.expression;

              if (
                expression?.type === 'AssignmentExpression' &&
                expression.operator === '=' &&
                expression.left.type === 'MemberExpression' &&
                expression.left.object.type === 'ThisExpression' &&
                !expression.left.computed &&
                expression.right.type === 'UnaryExpression' &&
                expression.right.operator === 'void'
              ) {
                path.remove();
              }
            },
          },
        };
      },
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ],
  };
};
