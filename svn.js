/**
* @fileOverview SVN模块
* @author linktang brandonwei
* @requires jQuery
* @update 2016-03-30
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var tmpl = require("cdn/lib/tmpl");
    var dao = require('cdn/data/dao');
    var dialog = require('cdn/dialog');
    var svnTemplate = require("../../templates/svn.html.js");
    var tips = require('cdn/tips');
    var util = require('cdn/util');

    var _defaultErrMsg = '服务器繁忙，请稍后再试';
    // 用户svn配置数据，作为本页面上层作用域变量缓存
    var svnData;

    // 初始化事件
    var initEvent = function() {
        //点击CDN服务开启/关闭
        $('.js-svninfo-wrap').on('click','.js-swicth-cdn-server', function(){
            var self = $(this);
            if(self.hasClass('ui_switch_2_on')){
                dialog.create(tmpl.parse($("[data-cdn-tmpl=dialog_cdn_service_close]").html()), 520, null, 
                {
                    title : '关闭CDN服务',
                    preventResubmit : true,
                    'class' : "dialog_layer_v2 shutdown-cdn",
                    button : {
                        '确定' : function() {
                            //等待联调
                            var currStatus = 0;
                            setSvnService(false).done(function(d) {
                                setSvnServiceStatus(false);
                                tips.success('关闭CDN操作成功');
                                // 隐藏配置面板
                                hideAllPanel();
                            }).fail(function(d) {
                                tips.error((d && (d.errmsg || d.msg)) || _defaultErrMsg);
                            });

                            dialog.hide();                            
                            return true;
                        }
                    }
                });          
            }else{
                setSvnService(true).done(function(d) {
                    setSvnServiceStatus(true);
                    tips.success('开启CDN操作成功');
                    // 开启SVN服务后，重新获取一次面板数据
                    getSVNInfo().done(function(d) {
                        // 更新用户svn配置数据
                        svnData = d.data;
                        // path存在才显示操作面板
                        if (svnData.svn_path) {
                            // 显示配置面板
                            showAllPanel();
                            // 设置SVN服务按钮状态
                            setSvnServiceStatus(true);
                            // 更新面板数据
                            refreshPanelData();
                        }
                    }).fail(function(d){
                        tips.error((d && (d.errmsg || d.msg)) || _defaultErrMsg);
                    });
                }).fail(function(d) {
                    tips.error((d && (d.errmsg || d.msg)) || _defaultErrMsg);
                });
            }
            return false;
        });

        //自动生效开启/关闭
        $('.js-svninfo-wrap').on('click','.js-swicth-cdn-auto', function(){
            var self = $(this);
            var open = self.hasClass('ui_switch_2_on') ? 0 : 1;
            setCdnEffectMode(open).done(function(d) {
                if (open) {
                    self.addClass('ui_switch_2_on');
                    self.removeClass('ui_switch_2_off');
                }
                else {
                    self.removeClass('ui_switch_2_on');
                    self.addClass('ui_switch_2_off');
                }
                tips.success('设置成功');
            }).fail(function(d) {
                tips.error((d && (d.errmsg || d.msg)) || _defaultErrMsg);
            });
            return false;
        });
        
        //选项目
        $('.js-svninfo-wrap').on('change','.js-select-isps', function(){
            var self = $(this);
            var option = self.find('option:selected');
            var appid = self.data('appid');
            var id = option.val()*1;
            
            if(id!=0){
                $('.js-svn-path-str').text('https://cdn.yun.qq.com/'+appid+'/'+(id));
                $('.js-cdn-path-str').text('http://'+id+'.'+appid+'.cdn.myqcloud.com/'+(appid)+'/');
            
            }else{
                $('.js-svn-path-str').text('https://cdn.yun.qq.com/'+appid+'/');
                $('.js-cdn-path-str').text('http://'+appid+'.cdn.myqcloud.com/'+appid+'/');
            }
            updateAccountInfo(id); 
        });
        
        //CDN文件生效
        $('.js-svninfo-wrap').on('click','.js-btn-cdn-file', function(){
            var self = $(this);
            dialog.create(tmpl.parse($("[data-cdn-tmpl=dialog_cdn_manual]").html()), 520, null, 
            {
                title : 'CDN文件生效',
                preventResubmit : true,
                'class' : "dialog_layer_v2 shutdown-cdn",
                button : {
                    '确认' : function() {
                        setCdnSvnEffect().done(function(d) {
                            tips.success('操作成功');
                        }).fail(function(d){
                            tips.error((d && (d.errmsg || d.msg)) || _defaultErrMsg);
                        });
                        dialog.hide();
                        return true;
                    }
                }
            });
            return false;
        });
    };

    // 更新账号密码信息
    var updateAccountInfo = function(id){
        getSubUserInfo(id).done(function(d) {
            var data = d.data;
            if(data.exist=='yes'){
                var acc = data.data;
                var username = acc.user_name;
                $('.js-svn-account').text(username);
            }else if(data.exist=='no'){
                $('.js-svn-account').text($.cookie('cdn_appid'));
            }
        }).fail(function(d) {
            tips.error((d && (d.errmsg || d.msg)) || _defaultErrMsg);
        });
    };

    // 显示svn配置面板
    var showAllPanel = function() {
        $('[_dn_cdn_action="capacity"]').removeClass("hide");
        $('[_dn_cdn_action="project_select"]').removeClass("hide");
        $('[_dn_cdn_action="tip_box"]').removeClass("hide");
        $('[_dn_cdn_action="auto_delivery"]').removeClass("hide");
        $('[_dn_cdn_action="manual_delivery"]').removeClass("hide");
    };

    // 隐藏svn配置面板
    var hideAllPanel = function() {
        $('[_dn_cdn_action="capacity"]').addClass("hide");
        $('[_dn_cdn_action="project_select"]').addClass("hide");
        $('[_dn_cdn_action="tip_box"]').addClass("hide");
        $('[_dn_cdn_action="auto_delivery"]').addClass("hide");
        $('[_dn_cdn_action="manual_delivery"]').addClass("hide");
    };

    // 设置SVN功能按钮的状态
    var setSvnServiceStatus = function(open) {
        if (open) {
            $('[_dn_cdn_action="svn_service_status"]').removeClass("ui_switch_2_off").addClass("ui_switch_2_on");
        }
        else {
            $('[_dn_cdn_action="svn_service_status"]').removeClass("ui_switch_2_on").addClass("ui_switch_2_off");
        }
    };

    // 容量使用情况容量条及数据设置
    var setSVNUsageInfo = function(d) {
        var _svnUsageInfo = d.data;
        var total = _svnUsageInfo.quota_size;
        var left = _svnUsageInfo.remainder_size;
        var cont = $('.js-svninfo-wrap');
        var percent = ((total-left)/total*100).toFixed(2);
        if(percent>100){
            percent = 100;
        }
        cont.find('.js-svn-usage-total').text(format(total*1024));
        cont.find('.js-svn-usage-left').text(format(left*1024));
        cont.find('.js-svn-usage-progress').css('width',percent+'%');
        if(percent>70){
            $("[data-id=showticket]").show();
        }
    };

    // 容量单位转换方法
    var format = function (val, len) {
        len = len || 2;
        var txt = "B";
        if (val < 1024) {
            return val + txt;
        } else if ((val = val / 1024) < 1024) { //kb
            return val.toFixed(len) + "K" + txt;
        } else if ((val = val / 1024) < 1024) {//mb
            return val.toFixed(len) + "M" + txt;
        } else if ((val = val / 1024) < 1024) {//gb
            return val.toFixed(len) + "G" + txt;
        } else if ((val = val / 1024) < 1024) {//tb
            return val.toFixed(len) + "T" + txt;
        } else {//tb
            return val.toFixed(len) + "T" + txt;
        }
    };

    // 刷新页面显示的数据
    var refreshPanelData = function() {
        // 项目选择框设置
        var str = tmpl.parse($("[data-cdn-tmpl=cdn_select_project]").html(), {
            data : svnData
        });
        $('[_dn_cdn_action="project_select"] select').replaceWith(str);

        getSVNUsageInfo().done(function(d) {
            setSVNUsageInfo(d);
        }).fail(function(d) {
            tips.error((d && (d.errmsg || d.msg)) || _defaultErrMsg);
        });

        // 设置面板各种数据
        $('[_dn_cdn_action="remain_time"]').text(svnData.opt_cnt);
        $('[_dn_cdn_action="svn_address"]').text('https://cdn.yun.qq.com/'+svnData.appid+'/');
        $('[_dn_cdn_action="svn_account"]').text(svnData.appid);
        $('[_dn_cdn_action="svn_path"]').text(svnData.cdn_path);

        // 自动生效按钮状态
        if (svnData.auto_effect) {
            $('[_dn_cdn_action="svn_auto_delivery_status"]').removeClass("ui_switch_2_off").addClass("ui_switch_2_on");
        }
        else {
            $('[_dn_cdn_action="svn_auto_delivery_status"]').removeClass("ui_switch_2_on").addClass("ui_switch_2_off");
        }
    };

    /**
     * 以下function全是用defer包装之后的接口调用
     */
    //拉取svn页面信息
    var getSVNInfo = function(){
        var defer = $.Deferred();
        dao.getSVNInfo({
            data: {
                action_url: '/ajax/cdn/queryCdnInfo.php',
                mc_gtk: util.getACSRFToken()
            },
            success: function(d){
                if(d&&d.code==0){
                    defer.resolve(d);
                }else{
                    defer.reject(d);
                }
            },
            error: function(){
                defer.reject();
            }
        });
        return defer.promise();
    };

    //获取svn用量
    var getSVNUsageInfo = function(){
        var defer = $.Deferred();
        dao.getSVNUsageInfo({
            data: {
                app_id: $.cookie("cdn_appid")
            },
            success : function(d){
                if(d&&d.code==0){
                    defer.resolve(d);
                }else{
                    defer.reject(d);
                }
            },
            error: function(){
                defer.reject();
            }
        });
        return defer.promise();
    };

    // 获取子用户帐号信息
    var getSubUserInfo = function(id) {
        var defer = $.Deferred();
        dao.get_subuser({
            data: {
                project_id: id
            },
            success : function(d){
                if(d&&d.code==0){
                    defer.resolve(d);
                }else{
                    defer.reject(d);
                }
            },
            error: function(){
                defer.reject();
            }
        });
        return defer.promise();
    };

    // 打开或关闭Service,open为true时打开
    var setSvnService = function(open) {
        var defer = $.Deferred();
        if (open) {
            dao.setCdnServiceOpen({
                data: {
                    action_url: '/ajax/cdn/openCdn.php',
                    mc_gtk: util.getACSRFToken() //TODO 这个参数后面应该不需要
                },
                success : function(d){
                    if(d&&(d.code==0 || d.retcode==0)){
                        defer.resolve(d);
                    }else{
                        defer.reject(d);
                    }
                },
                error: function(){
                    defer.reject();
                }
            });
        } else {
            dao.setCdnServiceClose({
                data: {
                    action_url: '/ajax/cdn/closeCdn.php',
                    mc_gtk: util.getACSRFToken() //TODO 这个参数后面应该不需要
                },
                success : function(d){
                    if(d&&(d.code==0 || d.retcode==0)){
                        defer.resolve(d);
                    }else{
                        defer.reject(d);
                    }
                },
                error: function(){
                    defer.reject();
                }
            });
        }
        return defer.promise();
    };

    // 设置CDN服务自动生效，0是off，1是on
    var setCdnEffectMode = function(mode) {
        var defer = $.Deferred();
        dao.setCdnEffectMode({
            data: {
                action_url: '/ajax/cdn/setCdnEffectMode.php',
                cdnEffectMode: mode,
                mc_gtk: util.getACSRFToken() //TODO 这个参数后面应该不需要
            },
            success : function(d){
                if(d&&(d.code==0 || d.retcode==0)){
                    defer.resolve(d);
                }else{
                    defer.reject(d);
                }
            },
            error: function(){
                defer.reject();
            }
        });
        return defer.promise();
    };

    // 设置CDN服务手动生效
    var setCdnSvnEffect = function() {
        var defer = $.Deferred();
        dao.setCdnSvnEffect({
            data: {
                action_url: '/ajax/cdn/setCdnSvnEffect.php',
                mc_gtk: util.getACSRFToken() //TODO 这个参数后面应该不需要
            },
            success : function(d){
                if(d&&(d.code==0 || d.retcode==0)){
                    defer.resolve(d);
                }else{
                    defer.reject(d);
                }
            },
            error: function(){
                defer.reject();
            }
        });
        return defer.promise();
    };

    return{
        container: svnTemplate,
        init: function(){     
            // 获取用户svn配置
            getSVNInfo().done(function(d) {
                // 更新用户svn配置数据
                svnData = d.data;
                // path存在才显示操作面板
                if (svnData.svn_path) {
                    // 显示配置面板
                    showAllPanel();
                    // 设置SVN服务按钮状态
                    setSvnServiceStatus(true);
                    // 更新面板数据
                    refreshPanelData();
                }
                // 初始化面板的事件操作
                initEvent();
            }).fail(function(d){
                tips.error((d && (d.errmsg || d.msg)) || _defaultErrMsg);
            });
        }
    }

});/*  |xGv00|eea0528fb2f569634cddd06ab7294690 */