(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof exports === 'object') {
    exports = factory();
  } else {
    root.moduleResolver = factory();
  }
})(this, function () {
  // Ensures that a transpiled define statement does not wrap the default
  // export in an object with a default property.
  function amdDefaultExport(babel) {
    var types = babel.types;

    // Detects a call to define(deps, factory)
    function detectTranspiledDefine(path) {
      var expr, callee, args, deps, callback;

      if (!path.isExpressionStatement()) return;

      expr = path.get("expression");
      if (!expr.isCallExpression()) return;

      callee = expr.get("callee");
      if (!callee.isIdentifier({ name: "define" })) return;

      args = expr.get("arguments");
      if (args.length !== 2) return;

      deps = args[0];
      if (!deps.isArrayExpression()) return;

      callback = args[1];
      if (!callback.isFunctionExpression()) return;

      return { deps: deps, callback: callback };
    }

    function returnDefaultExport(define, options) {
      var deps = define.deps;
      var moduleNames = deps.get('elements');
      var callback = define.callback;
      var i, len, moduleIndex, exportsIndex, moduleParam, exportsParam, moduleName,
          params, param, run, body, stats, stat, expr, left, obj, prop, exportsStat;

      for (i = 0, len = moduleNames.length; i < len; ++i) {
        moduleName = moduleNames[i];
        if (moduleName.isStringLiteral()) {
          switch (moduleName.node.value) {
            case 'module':
              moduleIndex = i;
              break;
            case 'exports':
              exportsIndex = i;
              break;
          }
        }
      }
      if (exportsIndex === undefined) return;

      params = callback.get('params');
      exportsParam = params[exportsIndex];
      if (!exportsParam || !exportsParam.isIdentifier()) {
        throw new Error('missing or invalid exports argument');
      }
      exportsParam = exportsParam.node.name;

      body = callback.get('body');
      if (!body.isBlockStatement()) {
        throw new Error('missing body');
      }
      stats = body.get('body');
      for (i = 0, len = stats.length; i < len; ++i) {
        stat = stats[i];
        if (!stat.isExpressionStatement()) continue;
        expr = stat.get('expression');
        if (!expr.isAssignmentExpression()) continue;
        left = expr.get('left');
        if (!left.isMemberExpression()) continue;
        obj = left.get('object');
        if (!obj.isIdentifier() || obj.node.name !== exportsParam) continue;
        prop = left.get('property');
        if (!prop.isIdentifier() || prop.node.name !== 'default') continue;
        exportsStat = stat;
        break;
      }
      if (exportsStat === undefined) return;

      if (moduleIndex === undefined) {
        moduleParam = '_module';
        run = false;
        do {
          for (i = 0, len = params.length; i < len; ++i) {
            param = params[i];
            if (param.isIdentifier() && param.node.name === moduleParam) {
              moduleParam = '_' + moduleParam;
              run = true
              break;
            }
          }
        } while (run);
        deps.unshiftContainer('elements', types.stringLiteral('module'));
        callback.unshiftContainer('params', types.identifier(moduleParam));
      } else {
        moduleParam = params[moduleIndex];
        if (!moduleParam || !moduleParam.isIdentifier()) {
          throw new Error('missing or invalid module argument');
        }
        moduleParam = moduleParam.node.name;
      }

      body.pushContainer('body', types.expressionStatement(
        types.assignmentExpression('=',
          types.memberExpression(types.identifier(moduleParam), types.identifier('exports')),
          types.memberExpression(types.identifier(exportsParam), types.identifier('default')))))
      if (options && options.addDefaultProperty) {
        body.pushContainer('body', types.expressionStatement(
          types.assignmentExpression('=',
            types.memberExpression(
              types.memberExpression(types.identifier(moduleParam), types.identifier('exports')),
              types.identifier('default')),
            types.memberExpression(types.identifier(exportsParam), types.identifier('default')))))
      }
    }

    // Ensures that a transpiled define statement does not wrap the default
    // export in an object with a default property.
    function ensureDefineWithDefaultExport(path, state) {
      var body = path.get('body');
      var length = body.length;
      var i, define;
      for (i = 0; i < length; ++i) {
        // If define or require is detected, process it and leave.
        define = detectTranspiledDefine(body[i]);
        if (define) {
          return returnDefaultExport(define, state.opts);
        }
      }
    }

    return {
      name: 'amd-default-export',

      visitor: {
        Program: { exit: ensureDefineWithDefaultExport }
      }
    };
  }

  return amdDefaultExport;
});
