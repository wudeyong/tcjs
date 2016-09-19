/**
* @fileOverview CDN ftp/svn 账号管理
* @author linktang
* @requires jQuery
* @update 2015-06-16
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
	var tmpl = require("cdn/lib/tmpl");
	var dao = require('cdn/data/dao');
	var packetTemplate = require("../../templates/account.html.js");
	var dialog = require('cdn/dialog');
	var pager = require('cdn/lib/pager');
	var tips = require('cdn/tips');
	var dateUtil = require('cdn/lib/date');
	var PAGE_SIZE = 10;
	var _defaultErrMsg = '服务器繁忙，请稍后再试';
	var _projList = null;
	var _accData;
	
	
	
	//添加子账号
	var addSubUser = function(dom){
		
		var defer = $.Deferred();
		
		var param = {};
		
		if(dom.find('input').hasClass('error')){
			defer.reject();
		}else{
			
			
			var acc = $.trim(dom.find('.js-input-account').val());
			var appid = $.cookie('cdn_appid');
			acc = appid+'_'+acc;
			var path = $.trim(dom.find('.js-input-directory').val());
			var pwd = $.trim(dom.find('.js-input-password').val());
			var repwd = $.trim(dom.find('.js-input-repassword').val());
			
			var type = dom.find('.js-select-acc-type').val();
			var pid = dom.find('.js-select-project').val();
			
			var note = dom.find('.js-textarea-note').val();
			var arr = [];
			arr.push({
				user_name:acc,
				path:path,
				password:pwd,
				type:type,
				project_id:pid,
				note:note
			});
			
			param.subusers = JSON.stringify(arr);
			dao.add_subuser({
				data:param,
				success:function(d){
					d = d || {};
					if(d&&d.code==0){
						defer.resolve(d);
					}else{
						defer.reject(d);
					}
				},
				error:function(d){
					d = d || {};
					defer.reject(d);
				}
			});
		}
		
		return defer.promise();
	}
	
	//修改子账号
	var modifySubUser = function(dom){
		
		var defer = $.Deferred();
		
		var param = {};
		
		if(dom.find('input').hasClass('error')){
			defer.reject();
		}else{
			
			
			var acc = $.trim(dom.find('.js-span-account').text());
			var pwd = $.trim(dom.find('.js-input-old-password').val());
			var repwd = $.trim(dom.find('.js-input-repassword').val());
			
			var arr = [];
			arr.push({
				user_name:acc,
				password:{old:pwd,"new":repwd}
			});
			
			param.subusers = JSON.stringify(arr);
			dao.modify_subuser({
				data:param,
				success:function(d){
					d = d || {};
					if(d&&d.code==0){
						defer.resolve(d);
					}else{
						defer.reject(d);
					}
				},
				error:function(d){
					d = d || {};
					defer.reject(d);
				}
			});
		}
		
		return defer.promise();
	}
	
	//删除
	var delSubUser = function(opt){
		
		var defer = $.Deferred();
		var param = {};
		var arr = [];
			arr.push({
				user_name:opt.user_name,
				password:opt.password
			});
			
			param.subusers = JSON.stringify(arr);
		
		dao.del_subuser({
			data:param,
			success:function(d){
				d = d || {};
				if(d&&d.code==0){
					defer.resolve(d);
				}else{
					defer.reject(d);
				}
			},
			error:function(d){
				d = d || {};
				defer.reject(d);
			}
		});
		
		return defer.promise();
	}

	//获取项目列表
	var getSubuserMenu = function(){
		
		var defer = $.Deferred();
		
		dao.get_subuser_menu({
			data	: {},
			success	: function(d){
				d = d || {};
				if(d&&d.code==0){
					var data = d.data || {};
					var projects = data.projects;
					_projList = projects;

					if(!projects.length) {
						$('.js-account-common').addClass('warning').html('您当前尚未使用腾讯云CDN托管源功能，无可设置托管源分权限管理的内容；您可以在接入管理中增加托管源接入方式。<a target="_blank" href="http://www.qcloud.com/doc/product/228/CDN%E6%8E%A5%E5%85%A5%E6%96%B9%E5%BC%8F%E9%80%89%E6%8B%A9#cdn接入ftp托管源">如何添加托管源</a>')
						$('.js-btn-add-account').remove()
					}else{
						$('.js-account-common').html(
							'1、托管源权限管理账号默认为云服务账号，可<a href="/cloudAccount" target="_blank"> 点击此查看 </a>您的云服务账号及密码<br>'+
							'2、腾讯云CDN支持对托管源的内容进行分权限管理，您可为已经接入托管源的项目创建子账号进行分权限管理，一个子账号只能对应一个项目<br>'+
							'3、若您当前需要开启分项目功能，可联系一线客服协助处理')
						$('.js-btn-add-account').show()
					}

					defer.resolve(projects);
				}else{
					tips.error(d.msg || _defaultErrMsg);
					defer.reject(d);
				}
			},
			error	: function(d){
				d = d || {};
				tips.error(d.msg || _defaultErrMsg);
				defer.reject(d);
			}
		});
		
		return defer.promise();
	}
	
	//获取账号列表
	var getSubusersList = function(){
		
		var defer = $.Deferred();
		
		var param  = {};
		
		dao.get_subusers({
			data:param,
			success:function(d){
				defer.resolve(d);
				
			},
			error:function(){
				defer.reject(d);
			}
		})
		
		
		
		return defer.promise();
	}
	
	//检查账号
	var checkAccount = function(self){
		var acc = ($(self).val());
		var reg = /(((?=.*\d)(?=.*[a-zA-Z]))|((?=.*\d)(?=.*[_]))|((?=.*[a-zA-Z])(?=.*[_]))|((?=.*[a-zA-Z])(?=.*\d))|((?=.*[_])(?=.*\d))|((?=.*[_])(?=.*[a-zA-Z])))^.{4,20}$/g;
		var reg2 = /[^a-zA-Z\d_]/;
		
		if(!acc || reg2.test(acc) || !reg.test(acc)){
			self.addClass('error').siblings('.js-err-tips').show();
			self.siblings('.js-success-tips').hide();
			return false;
		}else{
			self.removeClass('error').siblings('.js-err-tips').hide();
			self.siblings('.js-success-tips').show();
			return true;
		}
	}
	
	//检查授权文件夹
	var checkDirectory = function(self) {
		var directory = $(self).val();
		var reg = /[\.]/;
		if(reg.test(directory)) {
			self.addClass('error').siblings('.js-err-tips').show();
			self.siblings('.js-success-tips').hide();
			return false;
		}else{
			self.removeClass('error').siblings('.js-err-tips').hide();
			self.siblings('.js-success-tips').show();
			return true;
		}
	}

	//检查密码格式
	var checkPassword = function(self){
		var pwd = $.trim($(self).val());
		var res = false;
		var reg = /(((?=.*\d)(?=.*[a-zA-Z]))|((?=.*\d)(?=.*[!@#$^*()]))|((?=.*[a-zA-Z])(?=.*[!@#$^*()]))|((?=.*[a-zA-Z])(?=.*\d))|((?=.*[!@#$^*()])(?=.*\d))|((?=.*[!@#$^*()])(?=.*[a-zA-Z])))^.{8,16}$/g;
		var reg2 = /[^a-zA-Z\d!@#$^*()]/;
		if(!pwd || reg2.test(pwd) || !reg.test(pwd)){
			self.addClass('error').parent().siblings('.js-err-tips').show();
			self.parent().siblings('.js-success-tips').hide();
			return res;
		}
		
		self.removeClass('error').parent().siblings('.js-err-tips').hide();
		self.parent().siblings('.js-success-tips').show();
		
		return true;
	}
	//二次检查密码
	var checkRePassword = function(dom1,dom2){
		var pwd = $.trim($(dom1).val());
		var re_pwd = $.trim($(dom2).val());
		if(re_pwd.length>16 || re_pwd.length<8 || pwd !== re_pwd){
			dom2.addClass('error').parent().siblings('.js-err-tips').show();
			dom2.parent().siblings('.js-success-tips').hide();
			return false;
		}
		
		dom2.removeClass('error').parent().siblings('.js-err-tips').hide();
		dom2.parent().siblings('.js-success-tips').show();
		return true;
	}
	
	var checkOldPassword = function(dom1,dom2){
		var pwd = $.trim($(dom1).val());
		var re_pwd = $.trim($(dom2).val());
		
		var res1 = checkPassword(dom1);
		var res2 = checkPassword(dom2);
		
		if(pwd!==re_pwd){
			dom2.removeClass('error').parent().siblings('.js-err-tips').hide();
			dom2.parent().siblings('.js-success-tips').show();
			return true;
		}
		
		
		dom2.addClass('error').parent().siblings('.js-err-tips').show();
		dom2.parent().siblings('.js-success-tips').hide();
		
		
		return false;
	}
	
	//刷新表格
	var refreshList = function(){
		getSubusersList().done(function(d){
    		if(d && d.code==0){
    			var data = d.data;
    			_accData = data;

    			initPager(data,0);
    		}
    		
    	}).fail(function(e){
    		tips.error((e&&e.msg) || _defaultErrMsg);
    	})
	}
	
	var _goPage = function(data, currentpage){
		var str = tmpl.parse($("[data-cdn-tmpl=cdn_account_table]").html(), {
			data : data.slice((currentpage - 1) * PAGE_SIZE, currentpage * PAGE_SIZE)
		})
		$('.js-table-account').html(str);
	}
	
	//处理分页
	var initPager = function(data, index){
		var cont = $(".js-pager-account");
		if(!data){
			cont.hide();
			return;
		}
		
		cont.show();
		pager.buildPage({
			"pageSize" : PAGE_SIZE,
			"currentpage" : index+1,
			"totalNum" : data.length,
			"onTurn" : function(currentpage, pagesize) {
				_goPage(data, currentpage);
			},
			"emptyTurn" : function(currentpage) {
				$("[data-page=btn]").hide();
			},
			"container" : cont[0]
		}, {
			"currCountType" : "html"
		});
		
		$(".js-pager-total").text(data.length);
		_goPage(data, 1);
	}
	
	//事件绑定
	var bindEvt = function(){
		
		//tab编辑事件处理
    	$('.js-table-account').on('click','.js-icon-edit',function(e){
    		
    		var self = $(this);
    		var bubble = self.next();
    		var text = self.prev().text();
    		bubble.show().find('input').val(text);
    		return false;
    		
    	});
    	
    	//搜索
    	$('.js-btn-acc-search').on('click',function(e){
    		
    		var self = $(this);
    		var key = self.prev().val();
    		if($.trim(key)){
    			var res = [];
	    		for(var i=0;i<_accData.length;i++){
	    			var t = _accData[i];
	    			if(t.project_name.indexOf(key)>=0||t.user_name.indexOf(key)>=0||t.type.indexOf(key)>=0){
	    				res.push(t);
	    			}
	    		}
	    		initPager(res,0)
    		}else{
    			initPager(_accData,0)
    		}
    		
    		return false;
    		
    	});
    	
		//修改备注事件处理
    	$('.js-table-account').on('click','.js-btn-note-ok',function(e){
    		
    		var self = $(this);
			var td = self.parents('td');
			var input = self.parent().prev();
			var user_name = td.siblings('.js-td-username').text();
			var note = input.val();
			
			if(note.length>200){
				
				tips.error('备注输入的长度不能超过200，请您重新输入')
				return false;	
			}
			
			var param = {};
			var arr= [];
			arr.push({
				user_name:user_name,
				note:note
			});
			param.subusers = JSON.stringify(arr);
			
			dao.modify_subuser({
				data:param,
				success:function(d){
					d = d || {};
					if(d.code==0){
						self.parents('.tc-bubble').hide();
						td.find('.js-span-note').text(note);
					}else{
						tips.error(d.msg || _defaultErrMsg);
					}
				},
				error:function(d){
					d = d||{};
					tips.error(d.msg || _defaultErrMsg);
					self.parents('.tc-bubble').hide();
				}
			});
			
			
    		return false;
    		
    	});
    	
    	//隐藏备注框处理
    	$('.js-table-account').on('click','.js-btn-note-cancel',function(e){
    		
    		var self = $(this);
			self.parents('.tc-bubble').hide();
			
    		return false;
    		
    	});
    	
    	//点击重置账号密码
    	$('.js-table-account').on('click','.js-btn-modify-pwd',function(e){
    		
    		var self = $(this);
    		
    		var td = self.parents('td');
			var user_name = td.siblings('.js-td-username').text();
			var proj_name = td.siblings('.js-td-projname').text();
			var type = td.siblings('.js-td-type').text();
			var appid = $.cookie('cdn_appid');
			var pid = self.data('pid');
			var path = self.data('path');

    		var d = {
    			user_name:user_name,
    			proj_name:proj_name,
    			project_id:pid,
    			app_id:appid,
    			path:path,
    			type:type
    		};
    		var dd = dialog.create(tmpl.parse($("[data-cdn-tmpl=dialog_cdn_modify_password]").html(),{data:d}), 670, null, 
				{
					title : '重置密码',
					'class' : "dialog_layer_v2 add-source",
					button : {
						'确定' : function() {
							
							var pwd_old_dom = dd.find('.js-input-old-password');
							var pwd_dom = dd.find('.js-input-password');
							
							if(!checkPassword(pwd_dom)){
								return false;
							}
							
							var re_pwd_dom = dd.find('.js-input-repassword');
							
							if(!checkRePassword(pwd_dom, re_pwd_dom)){
								return false;
							}
							
							modifySubUser(dd).done(function(d){
								if(d&&d.code==0){
									tips.success('修改密码成功');
									dialog.hide();
									refreshList();
								}
							}).fail(function(e){
								var msg = e && e.msg || _defaultErrMsg;
								tips.error(msg);
							})
							
							return false;
						}
					}
				});
				
				dd.find('.js-input-old-password').focus();
				
				//聚焦的时候不要给错误提示
				dd.find('input').off('focus').on('focus',function(){
					
					var self = $(this);
					self.parent().removeClass('error').siblings('.js-err-tips').hide();
					self.parent().siblings('.js-success-tips').hide();
					return false;
				});
				
				//点击X清空输入
				dd.find('.js-input-clear').off('click').on('click',function(){
					
					var self = $(this);
					self.siblings('input').val('');
					return false;
				});
				
				//判断密码对不对
				dd.find('.js-input-old-password').off('blur').on('blur',function(){
					
					var self = $(this);
					checkPassword(self);
					return false;
				});
				dd.find('.js-input-password').off('blur').on('blur',function(){
					
					var self = $(this);
					checkPassword(self);
					return false;
				});
				
				//判断密码对不对
				/*
				dd.find('.js-input-password').off('blur').on('blur',function(){
					
					var self = $(this);
					//checkPassword(self);
					var old = dd.find('.js-input-old-password');
					//不能和老密码相同
					checkOldPassword(old, self);
					
					return false;
				});
				*/
				//判断密码对不对
				dd.find('.js-input-repassword').off('blur').on('blur',function(){
					
					var self = $(this);
					var old = dd.find('.js-input-password');
					checkRePassword(old, self);
					
					return false;
				});
				
				
    		
    		return false;
    		
    	});
    	
    	
    	//点击删除账号
    	$('.js-table-account').on('click','.js-btn-del-acc',function(e){
    		
    		var self = $(this);
    		
    		var user_name = self.data('username');
    		var d = {
    			user_name:user_name
    		};
    		var dd = dialog.create(tmpl.parse($("[data-cdn-tmpl=dialog_cdn_del_account]").html(),{data:d}), 570, null, 
				{
					title : '删除账号',
					'class' : "dialog_layer_v2 add-source",
					button : {
						'确定' : function() {
							
							var user_name = dd.find('.js-username').text();
							var pwd = dd.find('.js-password').val();
							
							if(!pwd){
								tips.error('密码输入不能为空');
								dd.find('.js-password').focus();
								return false;
							}
							
							delSubUser({
								user_name:user_name,
								password:pwd
							}).done(function(d){
								if(d&&d.code==0){
									tips.success('删除账号成功');
									dialog.hide();
									refreshList();
								}
							}).fail(function(e){
								var msg = e && e.msg || _defaultErrMsg;
								tips.error(msg);
							})
							
							return false;
						}
					}
				});
				
				//进来的时候聚焦输入框
				dd.find('.js-password').focus();
				
				//聚焦的时候不要给错误提示
				/*
				dd.find('input').off('focus').on('focus',function(){
					
					var self = $(this);
					self.removeClass('error').siblings('.js-err-tips').hide();
					self.siblings('.js-success-tips').hide();
					return false;
				});
				*/
				
				//点击X清空输入
				dd.find('.js-input-clear').off('click').on('click',function(){
					
					var self = $(this);
					self.siblings('input').val('').focus();
					return false;
				});
				
    		
    		return false;
    		
    	});
    	
    	//点击添加账号
    	$('.js-btn-add-account').on('click', function(e){
    		
    		var self = $(this);

			var appid = $.cookie('cdn_appid');
			var dd = dialog.create(tmpl.parse($("[data-cdn-tmpl=dialog_cdn_add_account]").html(),{data:_projList, appid:appid}), 690, null, 
			{
				title : '添加子账号',
				'class' : "dialog_layer_v2 add-source",
				button : {
					'确定' : function() {
						
						var pwd_dom = dd.find('.js-input-password');
						var acc_dom = dd.find('.js-input-account');
						var dir_dom = dd.find('.js-input-directory');

						if(!checkAccount(acc_dom)){
							return false;								
						}

						if(!checkDirectory(dir_dom)){
							return false;								
						}
						
						if(!checkPassword(pwd_dom)){
							return false;
						}
						
						var re_pwd_dom = dd.find('.js-input-repassword');
						
						if(!checkRePassword(pwd_dom, re_pwd_dom)){
							return false;
						}
						
						addSubUser(dd).done(function(d){
							if(d&&d.code==0){
								tips.success('添加账号成功');
								dialog.hide();
								refreshList();
							}
						}).fail(function(e){
							var msg = e && e.msg || _defaultErrMsg;
							tips.error(msg);
						})
						
						return false;
					}
				}
			});
			
			//切换类型
			dd.find('.js-select-acc-type').off('change').on('change',function(){
				
				var self = $(this);
				
				var type = self.val().toLowerCase();
				var appid = self.data('appid');
				var id = self.data('pid');
				
				if(type=='svn'){
					dd.find('.js-span-type').text('SVN上传地址');
					dd.find('.js-span-url').text('https://cdn.yun.qq.com/'+appid+'/'+(id));
					dd.find('.js-appointl-wrap').hide();
				}else if(type=='ftp'){
					dd.find('.js-span-type').text('FTP上传地址');
					dd.find('.js-span-url').text('ftp://ftp.cdn.qcloud.com/'+appid+'/'+(id));
					dd.find('.js-appointl-wrap').show();
					dd.find('.js-appoint-url').text('ftp://ftp.cdn.qcloud.com/'+appid+'/'+(id)+'/');
				}
				
				return false;
			});
			
			//选择项目
			dd.find('.js-select-project').off('change').on('change',function(){
				
				var self = $(this);
				var id = self.val();
				var typeDom = dd.find('.js-select-acc-type'); 
				var data;

				$.each(_projList, function(i, v) {
					if(v.id == id) {
						data = v
						return false
					}
				})

				var str = tmpl.parse($('[data-cdn-tmpl=cdn_add_account_acc_select]').html(), {
					data: data
				})
				typeDom.html(str)
				typeDom.data('pid', id)

				$('.js-select-acc-type').trigger('change')
				/*var type = typeDom.val().toLowerCase();
				var appid = typeDom.data('appid');

				if(type=='svn'){
					dd.find('.js-span-type').text('SVN上传地址');
					dd.find('.js-span-url').text('https://cdn.yun.qq.com/'+appid+'/'+(id));
					dd.find('.js-appoint-url').text('https://cdn.yun.qq.com/'+appid+'/'+(id)+'/');
				}else if(type=='ftp'){
					dd.find('.js-span-type').text('FTP上传地址');
					dd.find('.js-span-url').text('ftp://ftp.cdn.qcloud.com/'+appid+'/'+(id));
					dd.find('.js-appoint-url').text('ftp://ftp.cdn.qcloud.com/'+appid+'/'+(id)+'/');
				}*/
				
				return false;
			});
			$('.js-select-project').trigger('change')

			//失去焦点的时候判断输入是否OK
			dd.find('.js-input-directory').off('blur').on('blur',function(){
				
				var self = $(this);
				checkDirectory(self);
				return false;
			});
			
			//聚焦的时候不要给错误提示
			dd.find('.js-input-directory').off('focus').on('focus',function(){
				
				var self = $(this);
				self.removeClass('error').siblings('.js-err-tips').hide();
				self.siblings('.js-success-tips').hide();
				return false;
			});


			//失去焦点的时候判断输入是否OK
			dd.find('.js-input-account').off('blur').on('blur',function(){
				
				var self = $(this);
				checkAccount(self);
				return false;
			});
			
			//聚焦的时候不要给错误提示
			dd.find('input[type=password]').off('focus').on('focus',function(){
				
				var self = $(this);
				self.parent().removeClass('error').siblings('.js-err-tips').hide();
				self.parent().siblings('.js-success-tips').hide();
				return false;
			});
			
			
			//聚焦的时候不要给错误提示
			dd.find('.js-input-account').off('focus').on('focus',function(){
				
				var self = $(this);
				self.removeClass('error').siblings('.js-err-tips').hide();
				self.siblings('.js-success-tips').hide();
				return false;
			});
			
			//点击X清空输入
			dd.find('.js-input-clear').off('click').on('click',function(){
				
				var self = $(this);
				self.siblings('input').val('');
				return false;
			});
			
			//判断密码对不对
			dd.find('.js-input-password').off('blur').on('blur',function(){
				
				var self = $(this);
				checkPassword(self);
				return false;
			});
			
			//判断二次密码是否对
			dd.find('.js-input-repassword').off('blur').on('blur',function(){
				
				var self = $(this);
				var pwd = dd.find('.js-input-password');
				
				checkRePassword(pwd, self);
				return false;
			});
				
    		
    		
    		return false;
    		
    	});
    	
	}
	
	
	
    return{
        container: packetTemplate,
        render: function(){
        },
        init: function(){
        	
        	getSubuserMenu();
        	
        	refreshList();

        	bindEvt();
        }
    }
});/*  |xGv00|70d6cba305e57772c8792002b3a3cbb9 */