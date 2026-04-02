function spoofTimezone(fp) {
  const tz = fp.timezone;
  if (!tz) return;

  if (tz.offset !== undefined) {
    const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function () {
      return tz.offset;
    };
  }

  if (tz.name) {
    const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      const result = origResolvedOptions.call(this);
      result.timeZone = tz.name;
      return result;
    };
  }

  if (tz.name) {
    const OrigDateTimeFormat = Intl.DateTimeFormat;
    const handler = {
      construct(target, args) {
        if (args.length < 2) args[1] = {};
        if (typeof args[1] === 'object' && !args[1].timeZone) {
          args[1].timeZone = tz.name;
        }
        return new target(...args);
      },
      apply(target, thisArg, args) {
        if (args.length < 2) args[1] = {};
        if (typeof args[1] === 'object' && !args[1].timeZone) {
          args[1].timeZone = tz.name;
        }
        return target.apply(thisArg, args);
      },
    };
    Intl.DateTimeFormat = new Proxy(OrigDateTimeFormat, handler);
    Intl.DateTimeFormat.prototype = OrigDateTimeFormat.prototype;
  }
}

module.exports = { spoofTimezone };
