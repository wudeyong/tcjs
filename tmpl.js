define(function(require, exports) {
			var toString = Object.prototype.toString;
			var AP = Array.prototype;

			var util = {};
			util.isString = function(val) {
				return toString.call(val) === '[object String]';
			};

			util.isObject = function(val) {
				return val === Object(val);
			};
			util.isArray = Array.isArray || function(val) {
				return toString.call(val) === '[object Array]';
			};

			util.escape = function(val) {
				return EP.getVal(val);
			}
			var EP = util.escape.prototype;
			EP.getVal = function(val) {
				var v;
				if (util.isString(val)) {
					v = EP.escString(val);
				} else if (util.isArray(val)) {
					v = EP.escArray(val);
				} else if (util.isObject(val)) {
					v = EP.escObject(val);
				} else {
					v = val;
				}
				return v;
			}
			EP.escObject = function(val) {
				var v = {}
				for (var n in val) {
					v[n] = EP.getVal(val[n]);
				}
				return v;
			}
			EP.escArray = function(val) {
				var v = [];
				for (var i = 0; i < val.length; i++) {
					v.push(EP.getVal(val[i]));
				}
				return v;
			}
			var escapeHTML = function(val) {
					var s = val;
					s = s.replace(/&/g, '&amp;');
					s = s.replace(/</g, '&lt;');
					s = s.replace(/>/g, '&gt;');
					s = s.replace(/\x27/g, '&#039;');
					s = s.replace(/\x22/g, '&quot;');
					return s;
			};
			EP.escString = function(val) {
				return escapeHTML(val);
			}
			/**	
			 * 模版替换引擎
			 * @fileoverview 文件描述
			 * @author zishunchen
			 */
			var _IS_NOT_CHROME = !navigator.userAgent.chrome;
			var _cache = {};
			function _getMixinTmplStr(rawStr, mixinTmpl) {
				if (!/\W/.test(rawStr)) {
					return '';
				}
				if (mixinTmpl) {
					for (var p in mixinTmpl) {
						var r = new RegExp('<%#' + p + '%>', 'g');
						rawStr = rawStr.replace(r, mixinTmpl[p]);
					}
				}
				return rawStr;
			};
			/**	
			 * 注释描述
			 * @param {String} str 需要替换的模版内容
			 * @param {Object} data 需要替换的模版Json数据
			 * @param {Object} opt 其他参数
			 * @type {Function}
			 * @return {String} 处理后的html模版
			 * @author unkown
			 */
			function tmpl(str, data, opt) {
				if (!str) {
					return '';
				}
				var strIsId, key, fn;
				opt = opt || {};
				strIsId = !/\W/.test(str);
				key = opt.key || (strIsId ? str : '');
				str = strIsId ? (document.getElementById(str) && document.getElementById(str).innerHTML || str) : str;
				str = opt.mixinTmpl ? _getMixinTmplStr(str, opt.mixinTmpl) : str;
				fn = (_IS_NOT_CHROME && key || strIsId) ? _cache[key] = _cache[key] || tmpl(str) : new Function("obj",
						"var _p_=[],print=function(){_p_.push.apply(_p_,arguments);};with(obj){_p_.push('"
								+ str.replace(/[\r\t\n\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, " ").split("\\'")
										.join("\\\\'").split("'").join("\\'").split("<%").join("\t").replace(/\t=(.*?)%>/g, "',$1,'").split("\t").join("');").split("%>").join("_p_.push('")
								+ "');}return _p_.join('');");
				return fn && data ? fn(data) : fn;
			};
			exports.parse = function(str, data, opt) {
				return tmpl(str, util.escape(data), opt);
			}
		});
/*  |xGv00|1de1be6e4b582c8e623a9374d6e31eb4 */