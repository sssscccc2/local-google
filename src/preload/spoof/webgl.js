function spoofWebGL(fp) {
  const webglConfig = fp.webgl;
  if (!webglConfig) return;

  patchContext(WebGLRenderingContext, webglConfig);
  if (typeof WebGL2RenderingContext !== 'undefined') {
    patchContext(WebGL2RenderingContext, webglConfig);
  }
}

function patchContext(ContextClass, config) {
  const origGetParameter = ContextClass.prototype.getParameter;
  ContextClass.prototype.getParameter = function (param) {
    const UNMASKED_VENDOR = 0x9245;
    const UNMASKED_RENDERER = 0x9246;
    if (param === UNMASKED_VENDOR && config.vendor) return config.vendor;
    if (param === UNMASKED_RENDERER && config.renderer) return config.renderer;
    return origGetParameter.call(this, param);
  };

  const origGetExtension = ContextClass.prototype.getExtension;
  ContextClass.prototype.getExtension = function (name) {
    const ext = origGetExtension.call(this, name);
    if (name === 'WEBGL_debug_renderer_info' && ext) {
      return new Proxy(ext, {
        get(target, prop) {
          return Reflect.get(target, prop);
        },
      });
    }
    return ext;
  };

  const origGetSupportedExtensions = ContextClass.prototype.getSupportedExtensions;
  ContextClass.prototype.getSupportedExtensions = function () {
    const exts = origGetSupportedExtensions.call(this);
    return exts;
  };

  const origGetShaderPrecisionFormat = ContextClass.prototype.getShaderPrecisionFormat;
  ContextClass.prototype.getShaderPrecisionFormat = function (...args) {
    return origGetShaderPrecisionFormat.apply(this, args);
  };
}

module.exports = { spoofWebGL };
