/**
* @fileOverview CDN流量包模块
* @author linktang
* @requires jQuery
* @update 2015-03-16
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
	var tmpl = require("cdn/lib/tmpl");
	var dao = require('cdn/data/dao');
	var packetTemplate = require("../../templates/package.html.js");
	var dialog = require('cdn/dialog');
	var pager = require('cdn/lib/pager');
	var tips = require('cdn/tips');
	var dateUtil = require('cdn/lib/date');
	var PAGE_SIZE = 9;
	var _packageData;
	var _payType;
	var _defaultErrMsg = '服务器繁忙，请稍后再试';
	var _defaultDateFormat = 'YYYY-MM';
	
	
	var getUserInfo = function() {
		dao.getUserInfo({
			success: function(d){
				if(d&&d.code==0){
					d.data.status === 'trial' && $('.tc-15-msg').show()
				}else{
					tips.error(d.msg || _defaultErrMsg);
				}
			},
			error	: function(d){
				d = d || {};
				tips.error(d.msg || _defaultErrMsg);
			}
		})
	}
	
	//处理分页
	var initPager = function(oridata, index, type){
		var cont = $(".js-package-pager");
		
		oridata = oridata || [];
		var data = [];
		if(type=='mypackage'){
			for(var i=0;i<oridata.length;i++){
				var d = oridata[i];
				if(d && d.is_expire==false){
					data.push(d);
				}
			}
		}else if(type=='expired'){
			for(var i=0;i<oridata.length;i++){
				var d = oridata[i];
				if(d && d.is_expire==true){
					data.push(d);
				}
			}
		}else{
			data = oridata;
		}
		
		
		
		if(data.length==0){
			cont.hide();
		}else{
			cont.show();
		}
		
		//TODO 重新设置去掉事件的影响
		cont.html(cont.html());

		// 判断是否显示来源
		var channel_show = false;
		for(var i=0, len=oridata.length; i<len; i++) {
			if(oridata[i].channel !== 'cdn') {
				channel_show = true
				break;
			}
		}
		if(channel_show) {
			$('.js-packagelist-'+ type +' .tc-15-table-fixed-head').find('.tc-15-table-col5').show();
			$('.js-packagelist-'+ type +' .tc-15-table-fixed-head').find('thead th:eq(4)').show();
		}else{
			$('.js-packagelist-'+ type +' .tc-15-table-fixed-head').find('.tc-15-table-col5').hide();
			$('.js-packagelist-'+ type +' .tc-15-table-fixed-head').find('thead th:eq(4)').hide();
		}

		pager.buildPage({
			"pageSize" : PAGE_SIZE,
			"currentpage" : index+1,
			"totalNum" : data.length,
			"onTurn" : function(currentpage, pagesize) {
				_goPage(data, currentpage, type);
			},
			"emptyTurn" : function(currentpage) {
				$("[data-page=btn]").hide();
			},
			"container" : cont[0]
		}, {
			"currCountType" : "html"
		});
		
		$(".js-pager-package-total").text(data.length);
		
		
		var _goPage = function(data, currentpage, type){
			var tpl_container;
			var container;
			if(type=='mypackage'){
				tpl_container = $("[data-cdn-tmpl=flux_package_mypackage_table]");
				container = $('.js-table-mypackage-wrap');
			}else if(type=='expired'){
				tpl_container = $("[data-cdn-tmpl=flux_package_expired_table]");
				container = $('.js-table-expired-wrap');
			}
			var oData = data.slice((currentpage - 1) * PAGE_SIZE, currentpage * PAGE_SIZE);
			oData.unshift({channel_show: channel_show})
			var str = tmpl.parse(tpl_container.html(), {
				data : oData
			})
			
			container.html(str);

		}
		
		_goPage(data, 1, type);

	}
	
	
	//拉流量包列表
	var getPackageList = function(opt){
		var param = {
			
		};
		dao.getFluxList({
			data	: param,
			success	: function(d){
				if(d&&d.code==0){
					var data = d.data;
					if(data){
						
					}else{
						//tips.success('您查询的记录结果为空');
						data = data || {};
					}
					_packageData = data.flux_package;

					fixPackageData(_packageData);

					_payType = data.pay_type || 'mypackage';
					initPager(_packageData, 0, 'mypackage');
					
				}else{
					tips.error(d.msg || _defaultErrMsg);
				}
			},
			error	: function(d){
				d = d || {};
				tips.error(d.msg || _defaultErrMsg);
			}
		});
	}
	
	//处理下数据格式
	var fixPackageData = function(data){
		
		if(!data){
			return;
		}
		
		for(var i=0;i<data.length;i++){
			var d = data[i];
			var unit;
			var tempData;
			d.create_time_str = '';
			d.enable_time_str = '';
			d.expire_time_str = '';
			d.price_str = d.price;
			if(d.create_time){
				d.create_time_str = dateUtil.formatDate(dateUtil.getDateInStr(d.create_time) , "YYYY-MM-DD hh:mm");
			}
			if(d.expire_time){
				d.expire_time_str = dateUtil.formatDate(dateUtil.getDateInStr(d.expire_time) , "YYYY-MM-DD");
			}
			
			if(d.price_str){//价格是分，展示时是元
				d.price_str = (d.price/100).toFixed(2);
			}

			tempData = d.flux_byte;
			unit = 1024;
			while(tempData >= 1024) {
				if (tempData % 1024 == 0) {
					tempData = tempData / 1024;
				}
				else {
					unit = 1000;
					tempData = 0;
				}
			}
			d.flux_used_str = formatFlux(d.flux_used, 2, unit);
			d.flux_byte_str = formatFlux(d.flux_byte, 2, unit);
			d.flux_percent = ((d.flux_used/d.flux_byte)*100).toFixed(2);
			d.channel_str = d.channel === 'cdn' ? '腾讯云' : d.channel === 'dnspod' ? 'DNSPOD' : '微信公众号';

		}
		
	}
	
	//事件绑定
	var bindEvt = function(){
		
		//流量包规则wiki链接
		$('.js-package-manage-wrap .js-package-wiki-link').on('click',function(e){
			
			window.open("http://www.qcloud.com/doc/product/228/%E8%AE%A1%E8%B4%B9%E8%AF%B4%E6%98%8E#4-cdn.E6.B5.81.E9.87.8F.E5.8C.85.E8.AE.A1.E8.B4.B9");
			return false;
		});
		
		//流量包购买链接
		$('.js-package-manage-wrap .js-package-tobuy-link').on('click',function(e){
			
			window.location.href="http://manage.qcloud.com/shoppingcart/shop.php?tab=cdn";
			return false;
		});
		
		//tab事件处理
		$('.js-package-manage-wrap .js-tab-package-wrap').on('click',function(e){
			
			var target = $(e.target);
			var li = target.parent();
			
			if(target.hasClass('js-tab-package-mypackage')){
				li.addClass('tc-cur').siblings('li').removeClass('tc-cur');
				$('.js-packagelist-mypackage').show().siblings('.js-packagelist').hide();
				
				//initPager(_packageData, 0, 'unuse');
				
			}else if(target.hasClass('js-tab-package-expired')){
				$('.js-packagelist-expired').show().siblings('.js-packagelist').hide();
				li.addClass('tc-cur').siblings('li').removeClass('tc-cur');
				
				
			}
			var tab = $('.js-tab-package-wrap li.tc-cur a');
			initPager(_packageData, 0, tab.data('type'));
			return false;
			
		});
		
		//点击排序
		$('.js-package-manage-wrap').on('click','.js-ico-sort',function(e){
			
			var self = $(this);
			if(self.hasClass('icon-sort-up')){
				self.removeClass('icon-sort-up');
				self.addClass('icon-sort-down');
				var type = self.data('sort-type');
				if(_packageData && _packageData.length){
					_packageData.sort(function(a,b){
						var d1 = new Date(a[type]).getTime();
						var d2 = new Date(b[type]).getTime();
						if(d1>d2){
							return 1;
						}else{
							return -1;
						}
					});
				}
			}else{
				self.removeClass('icon-sort-down');
				self.addClass('icon-sort-up');
				var type = self.data('sort-type');
				if(_packageData && _packageData.length){
					_packageData.sort(function(a,b){
						var d1 = new Date(a[type]).getTime();
						var d2 = new Date(b[type]).getTime();
						if(d1>d2){
							return -1;
						}else{
							return 1;
						}
					});
				}
			}
			var tab = $('.js-tab-package-wrap li.tc-cur a');
			initPager(_packageData, 0, tab.data('type'));
			
			return false;
			
		});
	}
	
	var formatFlux = function(val, len, unit) {
		var txt = "B",
			len = len || 0;

		//bytes
		if (val < unit) {
			return val + txt;
		} else if ((val = val / unit) < unit) { //kb
			return val.toFixed(len) + "K"+txt;
		} else if ((val = val / unit) < unit) {//mb
			return val.toFixed(len) + "M"+txt;
		} else if ((val = val / unit) < unit) {//gb
			return val.toFixed(len) + "G"+txt;
		} else if ((val = val / unit) < unit) {//tb
			return val.toFixed(len) + "T"+txt;
		} else {//tb
			return val.toFixed(len) + "T"+txt;
		}
	}
	
    return{
        container: packetTemplate,
        render: function(){
        },
        init: function(){
        	getUserInfo();
        	bindEvt();
        	if(/\/cdn\/tools\/package\/used/.test(window.location.href)){
        		$(".js-tab-package-mypackage").click();
        		getPackageList({
        			from:"wx"
        		});
        	}else{
        		getPackageList();
        	}
        }
    }
});/*  |xGv00|328f32be4215787dd66381a16a370ec3 */