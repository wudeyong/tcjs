define(function(require, exports) {
			var $ = require('$');
			var util = require("cdn/util");
            var cdnUtil = require("cdn/lib/util");
            var nmc = require("cdn/nmc");
            var reporter = require("cdn/reporter");
            var login = require("cdn/login");
            var dialog = require('cdn/dialog');
            var languageMap = require('cdn/lib/languageMap');
			var counter = 0;
			var instance = CDN.FormSender.instance;
			var proxyURL = CDN.FormSender.proxyURL;
			var myBrowser = (function() {
				var userAgent = navigator.userAgent; // 取得浏览器的userAgent字符串
				var isOpera = userAgent.indexOf("Opera") > -1;
				if (isOpera) {
					return "Opera"
				}; // 判断是否Opera浏览器
				if (userAgent.indexOf("Firefox") > -1) {
					return "FF";
				} // 判断是否Firefox浏览器
				if (userAgent.indexOf("Chrome") > -1) {
					return "Chrome";
				}
				if (userAgent.indexOf("Safari") > -1) {
					return "Safari";
				} // 判断是否Safari浏览器
				if (userAgent.indexOf("compatible") > -1 && userAgent.indexOf("MSIE") > -1 && !isOpera) {
					return "IE";
				}; // 判断是否IE浏览器
			})();

			var formSender = function(actionURL, method, data, proxyURL) {

				/**
				 * form的名称，默认为 _fpInstence_ + 计数
				 * 
				 * @type string
				 */
				this.name = "_fpInstence_" + counter;
				CDN.FormSender.instance[this.name] = this;
				counter++;
				/**
				 * 数据发送方式
				 * 
				 * @type string
				 */
				this.method = method || "POST";

				/**
				 * 数据请求地址
				 * 
				 * @type string
				 */
				this.uri = actionURL;

				/**
				 * 数据参数表
				 * 
				 * @type object
				 */
				this.data = (typeof(data) == "object" || typeof(data) == 'string') ? data : null;
				this.proxyURL = proxyURL;
				this._sender = null;

				/**
				 * 服务器正确响应时的处理
				 * 
				 * @event
				 */
				this.onSuccess = $.noop;

				/**
				 * 服务器无响应或预定的不正常响应处理
				 * 
				 * @event
				 */
				this.onError = $.noop;
			};

			CDN.FormSender.instance = {};
			counter = 0;

			formSender._errCodeMap = {
				999 : {
					msg : 'Connection or Server error'
				}
			};

			formSender.pluginsPool = {
				"formHandler" : []
			};

			formSender._pluginsRunner = function(pType, data) {
				var _s = formSender, l = _s.pluginsPool[pType], t = data, len;

				if (l && (len = l.length)) {
					for (var i = 0; i < len; ++i) {
						if (typeof(l[i]) == "function") {
							t = l[i](t);
						}
					}
				}

				return t;
			};

			/**
			 * 发送请求
			 * 
			 * @return {Boolean} 是否成功
			 */
			formSender.prototype.send = function() {
				if (this.method == 'POST' && this.data == null) {
					return false;
				}

				function clear(o) {
					o._sender = o._sender.callback = o._sender.errorCallback = o._sender.onreadystatechange = null;
					if (myBrowser == "Safari" || myBrowser == "Opera") {
						setTimeout((function() {
									return function(name) {
										$("#" + "_fp_frm_" + name).remove();
									}
								})(o.name), 50);
					} else {
						$("#" + "_fp_frm_" + o.name).remove();
					}
				}

				if (this._sender === null || this._sender === void(0)) {
					var sender = $("<iframe>").attr({
								id : "_fp_frm_" + this.name,
								name : "_fp_frm_" + this.name
							}).css({
								width : 0,
								height : 0,
								borderWidth : 0,
								display : "none"
							}).get(0)
					document.body.appendChild(sender);

					sender.callback = $.proxy(function(o) {
								clearTimeout(timer);
								this.onSuccess(o);
								clear(this);
							}, this);

					sender.errorCallback = $.proxy(function(o) {
								clearTimeout(timer);
								this.onError(o);
								clear(this);
							}, this);

					if (typeof(sender.onreadystatechange) != 'undefined') {
						sender.onreadystatechange = $.proxy(function(o) {
									if (this._sender.readyState == 'complete' && this._sender.submited) {
										clear(this);
										this.onError(formSender._errCodeMap[999]);
									}
								}, this);

					} else {
						var timer = setTimeout($.proxy(function(o) {
											try {
												var _t = this._sender.contentWindow.location.href;
												if (_t.indexOf(this.uri) == 0) {
													clearTimeout(timer);
													clear(this);
													this.onError(formSender._errCodeMap[999]);
												}
											} catch (err) {
												clearTimeout(timer);
												clear(this);
												this.onError(formSender._errCodeMap[999]);
											}
										}, this), 1500);
					}

					this._sender = sender;
				}
				this._sender.src = this.proxyURL;
				return true;
			};

			/**
			 * formSender对象自毁方法，用法 ins=ins.destroy();
			 * 
			 * @return {Object} null用来复写引用本身
			 */
			formSender.prototype.destroy = function() {
				var n = this.name;
				delete CDN.FormSender.instance[n]._sender;
				CDN.FormSender.instance[n]._sender = null;
				delete CDN.FormSender.instance[n];
				counter--;
				return null;
			};
			var getType = function(obj) {
				return obj === null ? "null" : obj === undefined ? "undefined" : Object.prototype.toString.call(obj).slice(8, -1).toLowerCase()
			};
			var defaultSuccCallback = {
				"0" : $.noop,
                "1":function(){
                    login.show();
                },
				"default" : function() {
				}
			};
			function succCallback(result, succ, option, cb, db) {
				var data = result[0] || {};
				cb = defaultSuccCallback;
				db = cb[data.code]|| cb["default"];
				if (getType(succ) === "object") {
					var sc = succ[data.code];
					if (sc) {
						var d = sc.apply(null, result);
						if (d)
							db.apply(null, [d, result])
					}else{
						if(data.code === 1) {
							db.apply(null, result)
						}else if(succ["default"]) {
                            succ["default"].apply(null, result);
                        }else{
                             db.apply(null, result)
                        }
                    }
				} else if (getType(succ) === "function")
					(succ || $.noop).apply(null, result);
				else
					db.apply(null, result)
			}
			/**
			 * outputformat=1 jsonp
			=1 要去拿cb外面包cb
			outputformat=2 json
			outputformat=3 form 有html
			 */
			function createJQXHR(uri, type, lowPostXHR, option, sameDomain) {
                var time=new Date();
				sameDomain = false;
				option = option || {};
				if (uri.charAt(0) === "/" && uri.charAt(1) !== "/") {
					uri = CDN.FormSender.serverUrl + uri;
				}
                option.withCredentials = true;
				var data = option.data || {};
                var showLoadingIcon = option.showLoadingIcon === undefined ? true : option.showLoadingIcon;
                var param= [];
                var startTime = new Date, times;
                if(type=="get"){
                    if (showLoadingIcon)
                    {
                        nmc.requestStart();
                    }
                    param.push( "_format="+"jsonp");
                }else if(type == "post" && (sameDomain || $.support.cors && option.withCredentials)){
                    param.push( "_format="+"json");
                }else{
                    if (showLoadingIcon)
                    {
                        nmc.requestStart();
                    }
                    param.push("_format="+"html");
                }
				param.push("g_tk=" + util.getACSRFToken());
                if(uri.indexOf("?")>-1){
                    uri +="&"+param.join("&");
                }else{
                    uri +="?"+param.join("&");
                }
                var psucc = option.success;
                var suss= function(){
                    // 中文翻译成英文
                    translator(arguments[0]);
                    times = new Date - startTime;
                    succCallback.apply(null, [arguments, psucc, option])
                }
                
                var xhrData = {
                    "type" : type,
                    "url" : uri,
                    "xhrFields" : {},
                    "withCredentials" : true,
                    "data" : data,
                    "dataType" : option.dataType || "json"
                };
                if (sameDomain) {
                } else if ($.support.cors && option.withCredentials)
                    xhrData.xhrFields.withCredentials = true;
                else if (type == "post") {
                    option.success = suss;
                    lowPostXHR(uri,option);
                    return
                }
				if (option.dataType == "jsonp") {
					xhrData.jsonp = CDN.FormSender.cbName;
				}
				var jqxhr = null;
				jqxhr = $.ajax(xhrData).done(suss).fail(function() {
							times = new Date - startTime;
                            translator(arguments[0]);
							(option.fail || $.noop).apply(null, arguments)
						}).always(function(re, status, xhr) {
                            translator(re);
                            if (showLoadingIcon)
                            {
                                nmc.requestStop();
                            }
                            var _action = /action=.*/.exec(uri);
                            if(re){
                                var retCode = re.code;
                            }else{
                                var retCode = status;
                            }
                            cdnUtil.retCode("cdn?"+_action,retCode,new Date()-time)
							re = re || {};
							var code;
							if (status == "success")
								if (re.code == undefined)
									code = 200;
								else
									code = re.code;
							else if (status == "error")
								code = re.status;
						});
				return jqxhr
			}
			function postIE(uri, option) {
                var time=new Date();
                var _action = /action=.*/.exec(uri);
				var fs = new formSender(uri, "post", option.data, proxyURL);
                var showLoadingIcon = option.showLoadingIcon === undefined ? true : option.showLoadingIcon;
				fs.onSuccess = function(re) {
					option.success = option.success || $.noop;
                    // 中文翻译成英文
                    translator(re);
					option.success(re);
                    if (showLoadingIcon)
                    {
                        nmc.requestStop();
                    }
                    cdnUtil.retCode("cdn?"+_action,re.code,new Date()-time)
				};
				fs.onError = function(re) {
                    // 中文翻译成英文
                    translator(re);
					option.error = option.error || $.noop;
					option.error(re);
                    if (showLoadingIcon)
                    {
                        nmc.requestStop();
                    }
                    cdnUtil.retCode("cdn?"+_action,re.code,new Date()-time)
				};
				fs.send();
			}
			function postXHR(uri, option) {
				option = option || {};
				return createJQXHR(uri,"post", function() {
							postIE.apply(null,arguments);
						}, option)
			}
			function getJsonp(uri, option) {
				option = option || {};
				option.dataType = "jsonp";
				return createJQXHR(uri, "get", $.noop, option)
			}
            function translator(re) {
                if (CDN.base.language == "en") {
                    if (re.code != 0) {
                        re.msg = languageMap.errorCode.en[re.code] || "The service is busy now, please try later."
                    }
                }
            }
			exports.get = getJsonp;
			exports.post = postXHR
		});
/*  |xGv00|4cc4e41527c01e77e8e5f7ef5ceed137 */