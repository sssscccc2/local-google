const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '..', 'extension-template');

class ExtensionBuilder {
  static build(targetDir, fingerprint) {
    fs.mkdirSync(targetDir, { recursive: true });

    const templateFiles = ['manifest.json', 'background.js', 'inject.js'];
    for (const file of templateFiles) {
      fs.copyFileSync(path.join(TEMPLATE_DIR, file), path.join(targetDir, file));
    }

    fs.writeFileSync(
      path.join(targetDir, 'config.json'),
      JSON.stringify(fingerprint, null, 2),
      'utf-8'
    );

    const spoofCode = ExtensionBuilder.generateSpoofScript(fingerprint);
    fs.writeFileSync(path.join(targetDir, 'spoof.js'), spoofCode, 'utf-8');
  }

  static generateSpoofScript(fp) {
    return `(function(){
"use strict";
var C=${JSON.stringify(fp)};

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
for(var k in navProps){if(navProps[k]!==undefined){try{Object.defineProperty(Navigator.prototype,k,{get:(function(v){return function(){return v}})(k==='languages'?Object.freeze(navProps[k].slice()):navProps[k]),configurable:true})}catch(e){}}}
try{Object.defineProperty(Navigator.prototype,'webdriver',{get:function(){return undefined},configurable:true})}catch(e){}

/* ---- userAgentData ---- */
if(C.clientHints&&C.userAgent){
var m=C.userAgent.match(/Chrome\\/(\\d[\\d.]+)/);
var fv=m?m[1]:'132.0.6834.110';
var maj=fv.split('.')[0];
var uaData={
brands:[{brand:'Chromium',version:maj},{brand:'Google Chrome',version:maj},{brand:'Not?A_Brand',version:'99'}],
mobile:!!C.clientHints.mobile,
platform:C.clientHints.platform||'Windows',
getHighEntropyValues:function(h){
var r={brands:this.brands,mobile:this.mobile,platform:this.platform};
if(h.indexOf('platformVersion')>=0)r.platformVersion=C.clientHints.platformVersion||'15.0.0';
if(h.indexOf('architecture')>=0)r.architecture=C.clientHints.arch||'x86';
if(h.indexOf('bitness')>=0)r.bitness=C.clientHints.bitness||'64';
if(h.indexOf('model')>=0)r.model=C.clientHints.model||'';
if(h.indexOf('fullVersionList')>=0)r.fullVersionList=[{brand:'Chromium',version:fv},{brand:'Google Chrome',version:fv},{brand:'Not?A_Brand',version:'99.0.0.0'}];
if(h.indexOf('uaFullVersion')>=0)r.uaFullVersion=fv;
return Promise.resolve(r);
},
toJSON:function(){return{brands:this.brands,mobile:this.mobile,platform:this.platform}}
};
try{Object.defineProperty(Navigator.prototype,'userAgentData',{get:function(){return uaData},configurable:true})}catch(e){}
}

/* ---- Canvas ---- */
if(C.canvas&&C.canvas.noiseSeed){
var cseed=C.canvas.noiseSeed|0;
function crng(){cseed=(cseed+0x6d2b79f5)|0;var t=Math.imul(cseed^(cseed>>>15),1|cseed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}
var _gid=CanvasRenderingContext2D.prototype.getImageData;
CanvasRenderingContext2D.prototype.getImageData=function(){var d=_gid.apply(this,arguments);var p=d.data;var step=Math.max(1,Math.floor(p.length/100));for(var i=0;i<p.length;i+=step*4){var n=Math.floor(crng()*3)-1;p[i]=Math.min(255,Math.max(0,p[i]+n))}return d};
var _tdurl=HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL=function(){try{var ctx=this.getContext('2d');if(ctx){var id=ctx.getImageData(0,0,Math.min(this.width,4),Math.min(this.height,4));if(id.data.length>0){id.data[0]=Math.min(255,Math.max(0,id.data[0]+(Math.floor(crng()*3)-1)));ctx.putImageData(id,0,0)}}}catch(e){}return _tdurl.apply(this,arguments)};
var _tblob=HTMLCanvasElement.prototype.toBlob;
HTMLCanvasElement.prototype.toBlob=function(){try{var ctx=this.getContext('2d');if(ctx){var id=ctx.getImageData(0,0,Math.min(this.width,4),Math.min(this.height,4));if(id.data.length>0){id.data[0]=Math.min(255,Math.max(0,id.data[0]+(Math.floor(crng()*3)-1)));ctx.putImageData(id,0,0)}}}catch(e){}return _tblob.apply(this,arguments)};
}

/* ---- WebGL ---- */
if(C.webgl){
function patchGL(P){
var _gp=P.prototype.getParameter;
P.prototype.getParameter=function(p){if(p===0x9245&&C.webgl.vendor)return C.webgl.vendor;if(p===0x9246&&C.webgl.renderer)return C.webgl.renderer;return _gp.call(this,p)};
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
AnalyserNode.prototype.getFloatFrequencyData=function(a){_gffd.call(this,a);for(var i=0;i<a.length;i+=10)a[i]+=(arng()-0.5)*0.001};
}
if(typeof OfflineAudioContext!=='undefined'){
var _sr=OfflineAudioContext.prototype.startRendering;
OfflineAudioContext.prototype.startRendering=function(){return _sr.call(this).then(function(buf){for(var c=0;c<buf.numberOfChannels;c++){var d=buf.getChannelData(c);for(var i=0;i<d.length;i+=100)d[i]+=(arng()-0.5)*1e-7}return buf})};
}
}

/* ---- Screen ---- */
if(C.screen){
var sp={width:C.screen.width,height:C.screen.height,availWidth:C.screen.availWidth,availHeight:C.screen.availHeight,colorDepth:C.screen.colorDepth||24,pixelDepth:C.screen.pixelDepth||24};
for(var sk in sp){if(sp[sk]!==undefined){try{Object.defineProperty(Screen.prototype,sk,{get:(function(v){return function(){return v}})(sp[sk]),configurable:true})}catch(e){}}}
if(C.screen.devicePixelRatio!==undefined){try{Object.defineProperty(window,'devicePixelRatio',{get:function(){return C.screen.devicePixelRatio},configurable:true})}catch(e){}}
}

/* ---- Timezone ---- */
if(C.timezone){
if(C.timezone.offset!==undefined){Date.prototype.getTimezoneOffset=function(){return C.timezone.offset}}
if(C.timezone.name){
var _ro=Intl.DateTimeFormat.prototype.resolvedOptions;
Intl.DateTimeFormat.prototype.resolvedOptions=function(){var r=_ro.call(this);r.timeZone=C.timezone.name;return r};
}
}

/* ---- WebRTC ---- */
if(C.webrtc){
if(C.webrtc.mode==='disabled'){window.RTCPeerConnection=undefined;if(window.webkitRTCPeerConnection)window.webkitRTCPeerConnection=undefined}
else if(C.webrtc.mode==='disable_non_proxied_udp'&&typeof RTCPeerConnection!=='undefined'){
var _RTC=RTCPeerConnection;
window.RTCPeerConnection=function(cfg,con){
if(cfg&&cfg.iceServers){cfg.iceServers=cfg.iceServers.filter(function(s){var u=Array.isArray(s.urls)?s.urls:[s.urls||s.url];return u.some(function(x){return x&&x.indexOf('stun')===0})})}
var pc=new _RTC(cfg,con);
var _aic=pc.addIceCandidate.bind(pc);
pc.addIceCandidate=function(c){if(c&&c.candidate){var ip=c.candidate.match(/(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})/);if(ip){var p=ip[1].split('.').map(Number);if(p[0]===10||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||p[0]===127)return Promise.resolve()}}return _aic.apply(null,arguments)};
return pc};
window.RTCPeerConnection.prototype=_RTC.prototype;
}
}

/* ---- Plugins ---- */
if(C.plugins&&C.plugins.length){
var fp=C.plugins.map(function(p,i){return{name:p.name,filename:p.filename,description:p.description||'',length:1,item:function(){return null},namedItem:function(){return null}}});
var pa={length:fp.length,item:function(i){return fp[i]||null},namedItem:function(n){return fp.find(function(p){return p.name===n})||null},refresh:function(){}};
for(var pi=0;pi<fp.length;pi++)pa[pi]=fp[pi];
try{Object.defineProperty(Navigator.prototype,'plugins',{get:function(){return pa},configurable:true})}catch(e){}
}

/* ---- Fonts ---- */
if(C.fonts&&C.fonts.length&&typeof FontFaceSet!=='undefined'&&document.fonts){
var allowed=new Set(C.fonts.map(function(f){return f.toLowerCase()}));
var _fc=FontFaceSet.prototype.check;
document.fonts.check=function(font){
var m=font.match(/(?:\\d+(?:px|pt|em|rem|%)\\s+)?(?:['\"]?)([^'\",:]+)/);
if(m){var fn=m[1].trim().toLowerCase();if(!allowed.has(fn))return false}
return _fc.apply(this,arguments)};
}

})();`;
  }
}

module.exports = { ExtensionBuilder };
