const fs = require('fs');
const path = require('path');
const { TEMPLATE_DIR } = require('./paths');

class ExtensionBuilder {
  static build(targetDir, fingerprint, proxy) {
    fs.mkdirSync(targetDir, { recursive: true });

    const templateFiles = ['manifest.json', 'background.js'];
    for (const file of templateFiles) {
      fs.copyFileSync(path.join(TEMPLATE_DIR, file), path.join(targetDir, file));
    }

    const config = { ...fingerprint };
    if (proxy && proxy.type && proxy.type !== 'direct') {
      config.proxy = proxy;
    }

    fs.writeFileSync(
      path.join(targetDir, 'config.json'),
      JSON.stringify(config, null, 2),
      'utf-8'
    );

    const fpWithProxy = { ...fingerprint };
    if (proxy && proxy.type && proxy.type !== 'direct') {
      fpWithProxy.proxy = { type: proxy.type };
    }
    const spoofCode = ExtensionBuilder.generateSpoofScript(fpWithProxy);
    fs.writeFileSync(path.join(targetDir, 'spoof.js'), spoofCode, 'utf-8');
  }

  static generateSpoofScript(fp) {
    return `(function(){
"use strict";
var C=${JSON.stringify(fp)};

/* ---- Native Function Masking ---- */
var _nativeMap=new WeakMap();
var _origToString=Function.prototype.toString;
var _toStringDescriptor=Object.getOwnPropertyDescriptor(Function.prototype,'toString');
function _maskNative(fn,name){
  _nativeMap.set(fn,'function '+(name||fn.name||'')+'() { [native code] }');
}
var _newToString=function toString(){
  if(_nativeMap.has(this))return _nativeMap.get(this);
  return _origToString.call(this);
};
_nativeMap.set(_newToString,'function toString() { [native code] }');
Object.defineProperty(Function.prototype,'toString',{value:_newToString,writable:true,configurable:true});

/* ---- Navigator ---- */
var navProps={
userAgent:C.userAgent,
platform:C.platform||C.navigator&&C.navigator.platform,
language:C.navigator&&C.navigator.language,
languages:C.navigator&&C.navigator.languages,
hardwareConcurrency:C.navigator&&C.navigator.hardwareConcurrency,
deviceMemory:C.navigator&&C.navigator.deviceMemory,
maxTouchPoints:C.navigator&&C.navigator.maxTouchPoints!=null?C.navigator.maxTouchPoints:0
};
for(var k in navProps){if(navProps[k]!==undefined){try{
var _getter=(function(v,propName){
var fn=function(){return v};
_maskNative(fn,'get '+propName);
return fn;
})(k==='languages'?Object.freeze(navProps[k].slice()):navProps[k],k);
Object.defineProperty(Navigator.prototype,k,{get:_getter,configurable:true});
}catch(e){}}}

try{
var _wdGetter=function(){return false};
_maskNative(_wdGetter,'get webdriver');
Object.defineProperty(Navigator.prototype,'webdriver',{get:_wdGetter,configurable:true});
}catch(e){}

/* ---- navigator.connection ---- */
try{
var connObj=Object.create(EventTarget.prototype);
Object.defineProperties(connObj,{
  downlink:{get:function(){return 10},configurable:true,enumerable:true},
  effectiveType:{get:function(){return '4g'},configurable:true,enumerable:true},
  rtt:{get:function(){return 50},configurable:true,enumerable:true},
  saveData:{get:function(){return false},configurable:true,enumerable:true},
  onchange:{get:function(){return null},set:function(){},configurable:true,enumerable:true}
});
Object.defineProperty(Navigator.prototype,'connection',{get:function(){return connObj},configurable:true,enumerable:true});
}catch(e){}

/* ---- navigator.permissions ---- */
try{
var _origQuery=Permissions.prototype.query;
var _patchedQuery=function query(desc){
  if(desc&&desc.name==='notifications'){
    return Promise.resolve({state:'prompt',onchange:null,addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return true}});
  }
  return _origQuery.call(this,desc);
};
_maskNative(_patchedQuery,'query');
Permissions.prototype.query=_patchedQuery;
}catch(e){}

/* ---- navigator.getBattery ---- */
try{
var _batteryGetter=function getBattery(){
  return Promise.resolve({charging:true,chargingTime:0,dischargingTime:Infinity,level:1,addEventListener:function(){},removeEventListener:function(){}});
};
_maskNative(_batteryGetter,'getBattery');
Navigator.prototype.getBattery=_batteryGetter;
}catch(e){}

/* ---- userAgentData ---- */
if(C.clientHints&&C.userAgent){
var m=C.userAgent.match(/Chrome\\/(\\d[\\d.]+)/);
var fv=m?m[1]:'132.0.6834.110';
var maj=fv.split('.')[0];
var uaData={
brands:[{brand:'Chromium',version:maj},{brand:'Google Chrome',version:maj},{brand:'Not_A Brand',version:'24'}],
mobile:!!C.clientHints.mobile,
platform:C.clientHints.platform||'Windows',
getHighEntropyValues:function getHighEntropyValues(h){
var r={brands:this.brands,mobile:this.mobile,platform:this.platform};
if(h.indexOf('platformVersion')>=0)r.platformVersion=C.clientHints.platformVersion||'15.0.0';
if(h.indexOf('architecture')>=0)r.architecture=C.clientHints.arch||'x86';
if(h.indexOf('bitness')>=0)r.bitness=C.clientHints.bitness||'64';
if(h.indexOf('model')>=0)r.model=C.clientHints.model||'';
if(h.indexOf('fullVersionList')>=0)r.fullVersionList=[{brand:'Chromium',version:fv},{brand:'Google Chrome',version:fv},{brand:'Not_A Brand',version:'24.0.0.0'}];
if(h.indexOf('uaFullVersion')>=0)r.uaFullVersion=fv;
return Promise.resolve(r);
},
toJSON:function toJSON(){return{brands:this.brands,mobile:this.mobile,platform:this.platform}}
};
_maskNative(uaData.getHighEntropyValues,'getHighEntropyValues');
_maskNative(uaData.toJSON,'toJSON');
try{
var _uadGetter=function(){return uaData};
_maskNative(_uadGetter,'get userAgentData');
Object.defineProperty(Navigator.prototype,'userAgentData',{get:_uadGetter,configurable:true});
}catch(e){}
}

/* ---- window.chrome completeness ---- */
try{
if(!window.chrome)window.chrome={};
if(!window.chrome.app){
  window.chrome.app={isInstalled:false,InstallState:{DISABLED:'disabled',INSTALLED:'installed',NOT_INSTALLED:'not_installed'},RunningState:{CANNOT_RUN:'cannot_run',READY_TO_RUN:'ready_to_run',RUNNING:'running'}};
  var _getDetails=function getDetails(){return null};
  var _getIsInstalled=function getIsInstalled(){return false};
  _maskNative(_getDetails,'getDetails');
  _maskNative(_getIsInstalled,'getIsInstalled');
  window.chrome.app.getDetails=_getDetails;
  window.chrome.app.getIsInstalled=_getIsInstalled;
}
if(!window.chrome.csi){
  var _csi=function csi(){return{startE:Date.now(),onloadT:Date.now(),pageT:Math.random()*500+300,tran:15}};
  _maskNative(_csi,'csi');
  window.chrome.csi=_csi;
}
if(!window.chrome.loadTimes){
  var _lt=function loadTimes(){return{commitLoadTime:Date.now()/1000,connectionInfo:'h2',finishDocumentLoadTime:Date.now()/1000+0.3,finishLoadTime:Date.now()/1000+0.5,firstPaintAfterLoadTime:0,firstPaintTime:Date.now()/1000+0.1,navigationType:'Other',npnNegotiatedProtocol:'h2',requestTime:Date.now()/1000-0.5,startLoadTime:Date.now()/1000-0.5,wasAlternateProtocolAvailable:false,wasFetchedViaSpdy:true,wasNpnNegotiated:true}};
  _maskNative(_lt,'loadTimes');
  window.chrome.loadTimes=_lt;
}
if(!window.chrome.runtime){
  window.chrome.runtime={OnInstalledReason:{CHROME_UPDATE:'chrome_update',INSTALL:'install',SHARED_MODULE_UPDATE:'shared_module_update',UPDATE:'update'},PlatformArch:{ARM:'arm',ARM64:'arm64',MIPS:'mips',MIPS64:'mips64',X86_32:'x86-32',X86_64:'x86-64'},PlatformNaclArch:{ARM:'arm',MIPS:'mips',MIPS64:'mips64',X86_32:'x86-32',X86_64:'x86-64'},PlatformOs:{ANDROID:'android',CROS:'cros',LINUX:'linux',MAC:'mac',OPENBSD:'openbsd',WIN:'win'},RequestUpdateCheckStatus:{NO_UPDATE:'no_update',THROTTLED:'throttled',UPDATE_AVAILABLE:'update_available'}};
  var _connect=function connect(){};
  var _sendMessage=function sendMessage(){};
  _maskNative(_connect,'connect');
  _maskNative(_sendMessage,'sendMessage');
  window.chrome.runtime.connect=_connect;
  window.chrome.runtime.sendMessage=_sendMessage;
}
}catch(e){}

/* ---- Performance.now() precision reduction ---- */
try{
var _perfNow=Performance.prototype.now;
var _patchedPerfNow=function now(){
  return Math.round(_perfNow.call(this)*10)/10;
};
_maskNative(_patchedPerfNow,'now');
Performance.prototype.now=_patchedPerfNow;
}catch(e){}

/* ---- Canvas ---- */
if(C.canvas&&C.canvas.noiseSeed){
var cseed=C.canvas.noiseSeed|0;
function crng(){cseed=(cseed+0x6d2b79f5)|0;var t=Math.imul(cseed^(cseed>>>15),1|cseed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}
var _gid=CanvasRenderingContext2D.prototype.getImageData;
var _patchedGid=function getImageData(){var d=_gid.apply(this,arguments);var p=d.data;var step=Math.max(1,Math.floor(p.length/100));for(var i=0;i<p.length;i+=step*4){var n=Math.floor(crng()*3)-1;p[i]=Math.min(255,Math.max(0,p[i]+n))}return d};
_maskNative(_patchedGid,'getImageData');
CanvasRenderingContext2D.prototype.getImageData=_patchedGid;
var _tdurl=HTMLCanvasElement.prototype.toDataURL;
var _patchedTdurl=function toDataURL(){try{var ctx=this.getContext('2d');if(ctx){var id=_gid.call(ctx,0,0,Math.min(this.width,4),Math.min(this.height,4));if(id.data.length>0){id.data[0]=Math.min(255,Math.max(0,id.data[0]+(Math.floor(crng()*3)-1)));ctx.putImageData(id,0,0)}}}catch(e){}return _tdurl.apply(this,arguments)};
_maskNative(_patchedTdurl,'toDataURL');
HTMLCanvasElement.prototype.toDataURL=_patchedTdurl;
var _tblob=HTMLCanvasElement.prototype.toBlob;
var _patchedTblob=function toBlob(){try{var ctx=this.getContext('2d');if(ctx){var id=_gid.call(ctx,0,0,Math.min(this.width,4),Math.min(this.height,4));if(id.data.length>0){id.data[0]=Math.min(255,Math.max(0,id.data[0]+(Math.floor(crng()*3)-1)));ctx.putImageData(id,0,0)}}}catch(e){}return _tblob.apply(this,arguments)};
_maskNative(_patchedTblob,'toBlob');
HTMLCanvasElement.prototype.toBlob=_patchedTblob;
}

/* ---- WebGL ---- */
if(C.webgl){
function patchGL(P){
var _gp=P.prototype.getParameter;
var _pGp=function getParameter(p){if(p===0x9245&&C.webgl.vendor)return C.webgl.vendor;if(p===0x9246&&C.webgl.renderer)return C.webgl.renderer;return _gp.call(this,p)};
_maskNative(_pGp,'getParameter');
P.prototype.getParameter=_pGp;
}
if(typeof WebGLRenderingContext!=='undefined')patchGL(WebGLRenderingContext);
if(typeof WebGL2RenderingContext!=='undefined')patchGL(WebGL2RenderingContext);
}

/* ---- AudioContext ---- */
if(C.audio&&C.audio.noiseSeed){
var aseed=C.audio.noiseSeed|0;
function arng(){aseed=(aseed+0x6d2b79f5)|0;var t=Math.imul(aseed^(aseed>>>15),1|aseed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}
if(typeof AnalyserNode!=='undefined'){
var _gffd=AnalyserNode.prototype.getFloatFrequencyData;
var _pGffd=function getFloatFrequencyData(a){_gffd.call(this,a);for(var i=0;i<a.length;i+=10)a[i]+=(arng()-0.5)*0.001};
_maskNative(_pGffd,'getFloatFrequencyData');
AnalyserNode.prototype.getFloatFrequencyData=_pGffd;
}
if(typeof OfflineAudioContext!=='undefined'){
var _sr=OfflineAudioContext.prototype.startRendering;
var _pSr=function startRendering(){return _sr.call(this).then(function(buf){for(var c=0;c<buf.numberOfChannels;c++){var d=buf.getChannelData(c);for(var i=0;i<d.length;i+=100)d[i]+=(arng()-0.5)*1e-7}return buf})};
_maskNative(_pSr,'startRendering');
OfflineAudioContext.prototype.startRendering=_pSr;
}
}

/* ---- Screen ---- */
if(C.screen){
var sp={width:C.screen.width,height:C.screen.height,availWidth:C.screen.availWidth,availHeight:C.screen.availHeight,colorDepth:C.screen.colorDepth||24,pixelDepth:C.screen.pixelDepth||24};
for(var sk in sp){if(sp[sk]!==undefined){try{
var _sGetter=(function(v,n){var fn=function(){return v};_maskNative(fn,'get '+n);return fn;})(sp[sk],sk);
Object.defineProperty(Screen.prototype,sk,{get:_sGetter,configurable:true});
}catch(e){}}}
if(C.screen.devicePixelRatio!==undefined){try{
var _dprGetter=function(){return C.screen.devicePixelRatio};
_maskNative(_dprGetter,'get devicePixelRatio');
Object.defineProperty(window,'devicePixelRatio',{get:_dprGetter,configurable:true});
}catch(e){}}
}

/* ---- Timezone ---- */
if(C.timezone){
if(C.timezone.offset!==undefined){
var _gtz=function getTimezoneOffset(){return C.timezone.offset};
_maskNative(_gtz,'getTimezoneOffset');
Date.prototype.getTimezoneOffset=_gtz;
}
if(C.timezone.name){
var _ro=Intl.DateTimeFormat.prototype.resolvedOptions;
var _pRo=function resolvedOptions(){var r=_ro.call(this);r.timeZone=C.timezone.name;return r};
_maskNative(_pRo,'resolvedOptions');
Intl.DateTimeFormat.prototype.resolvedOptions=_pRo;
}
}

/* ---- WebRTC ---- */
if(C.webrtc){
var useProxy=C.proxy&&C.proxy.type&&C.proxy.type!=='direct';
if(C.webrtc.mode==='disabled'||useProxy){
var _fakeRTC=function RTCPeerConnection(){throw new DOMException('RTCPeerConnection blocked','NotAllowedError')};
_fakeRTC.prototype={};
_maskNative(_fakeRTC,'RTCPeerConnection');
window.RTCPeerConnection=_fakeRTC;
if(window.webkitRTCPeerConnection)window.webkitRTCPeerConnection=_fakeRTC;
if(typeof navigator!=='undefined'&&navigator.mediaDevices){
var _gum=navigator.mediaDevices.getUserMedia;
var _pGum=function getUserMedia(c){if(c&&!c.audio&&!c.video)return Promise.reject(new DOMException('Blocked','NotAllowedError'));return _gum.call(navigator.mediaDevices,c)};
_maskNative(_pGum,'getUserMedia');
navigator.mediaDevices.getUserMedia=_pGum;
}
}
else if(C.webrtc.mode==='disable_non_proxied_udp'&&typeof RTCPeerConnection!=='undefined'){
var _RTC=RTCPeerConnection;
var _wrappedRTC=function RTCPeerConnection(cfg,con){
if(cfg&&cfg.iceServers){cfg.iceServers=cfg.iceServers.filter(function(s){var u=Array.isArray(s.urls)?s.urls:[s.urls||s.url];return u.some(function(x){return x&&x.indexOf('stun')===0})})}
var pc=new _RTC(cfg,con);
var _aic=pc.addIceCandidate.bind(pc);
pc.addIceCandidate=function(c){if(c&&c.candidate){var ip=c.candidate.match(/(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})/);if(ip){var p=ip[1].split('.').map(Number);if(p[0]===10||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||p[0]===127)return Promise.resolve()}}return _aic.apply(null,arguments)};
return pc};
_wrappedRTC.prototype=_RTC.prototype;
_maskNative(_wrappedRTC,'RTCPeerConnection');
window.RTCPeerConnection=_wrappedRTC;
}
}

/* ---- Plugins (Chrome PDF Viewer) ---- */
try{
var chromePlugins=[
{name:'PDF Viewer',filename:'internal-pdf-viewer',description:'Portable Document Format'},
{name:'Chrome PDF Viewer',filename:'internal-pdf-viewer',description:'Portable Document Format'},
{name:'Chromium PDF Viewer',filename:'internal-pdf-viewer',description:'Portable Document Format'},
{name:'Microsoft Edge PDF Viewer',filename:'internal-pdf-viewer',description:'Portable Document Format'},
{name:'WebKit built-in PDF',filename:'internal-pdf-viewer',description:'Portable Document Format'}
];
var plugList=C.plugins&&C.plugins.length?C.plugins:chromePlugins;
var fakePlugins=plugList.map(function(p){return{name:p.name,filename:p.filename,description:p.description||'',length:1,item:function(){return null},namedItem:function(){return null}}});
var pluginArray={length:fakePlugins.length,item:function(i){return fakePlugins[i]||null},namedItem:function(n){return fakePlugins.find(function(p){return p.name===n})||null},refresh:function(){}};
for(var pi=0;pi<fakePlugins.length;pi++)pluginArray[pi]=fakePlugins[pi];
var _plugGetter=function(){return pluginArray};
_maskNative(_plugGetter,'get plugins');
Object.defineProperty(Navigator.prototype,'plugins',{get:_plugGetter,configurable:true});

var fakeMimes=[{type:'application/pdf',suffixes:'pdf',description:'Portable Document Format',enabledPlugin:fakePlugins[0]}];
var mimeArray={length:fakeMimes.length,item:function(i){return fakeMimes[i]||null},namedItem:function(t){return fakeMimes.find(function(m){return m.type===t})||null}};
for(var mi=0;mi<fakeMimes.length;mi++)mimeArray[mi]=fakeMimes[mi];
var _mimeGetter=function(){return mimeArray};
_maskNative(_mimeGetter,'get mimeTypes');
Object.defineProperty(Navigator.prototype,'mimeTypes',{get:_mimeGetter,configurable:true});

var _pdfGetter=function(){return true};
_maskNative(_pdfGetter,'get pdfViewerEnabled');
Object.defineProperty(Navigator.prototype,'pdfViewerEnabled',{get:_pdfGetter,configurable:true});
}catch(e){}

/* ---- Fonts ---- */
if(C.fonts&&C.fonts.length&&typeof FontFaceSet!=='undefined'&&document.fonts){
var allowed=new Set(C.fonts.map(function(f){return f.toLowerCase()}));
allowed.add('sans-serif');allowed.add('serif');allowed.add('monospace');allowed.add('cursive');allowed.add('fantasy');
var _fc=FontFaceSet.prototype.check;
var _pFc=function check(font){
var m=font.match(/(?:\\d+(?:px|pt|em|rem|%)\\s+)?(?:['\"]?)([^'\",:]+)/);
if(m){var fn=m[1].trim().toLowerCase();if(!allowed.has(fn))return false}
return _fc.apply(this,arguments)};
_maskNative(_pFc,'check');
document.fonts.check=_pFc;
}

/* ---- Notification permission consistency ---- */
try{
var _notifGetter=function(){return 'default'};
_maskNative(_notifGetter,'get permission');
Object.defineProperty(Notification,'permission',{get:_notifGetter,configurable:true});
}catch(e){}

/* ---- Iframe contentWindow consistency ---- */
try{
var _origCW=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow');
if(_origCW&&_origCW.get){
var _pCW=function(){
var w=_origCW.get.call(this);
if(w){try{
Object.defineProperty(w.navigator,'webdriver',{get:function(){return false},configurable:true});
}catch(e){}}
return w;
};
_maskNative(_pCW,'get contentWindow');
Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{get:_pCW,configurable:true});
}
}catch(e){}

})();`;
  }
}

module.exports = { ExtensionBuilder };
