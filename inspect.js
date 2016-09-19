/**
* @CDN节点IP查找管理模块
* @author brandonwei
* @requires jQuery
* @update 2016-02-25
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var tmpl = require("cdn/lib/tmpl");
    var dateUtil = require('cdn/lib/date');
    var dao = require('cdn/data/dao');
    var queryTemplate = require("../../templates/inspect.html.js");
    var tips = require('cdn/tips');
    var util = require('cdn/util');
    var cdnUtil = require('cdn/lib/util');
    var _defaultErrMsg = '服务器繁忙，请稍后再试';

    // 设置一个校验延迟
    var checkInputTimeout = null;

    var bindEvent = function() {
        // 验证按钮
        var $verifyBtn = $("[_dn_cdn_action='verify']");
        // 输入校验事件
        var initInputEvent = function() {
            $("[_dn_cdn_action='ip_input']").on('keyup', function(e) {
                var target = $(this);
                var ip = target.val().trim();
                if (checkInputTimeout) {
                    clearTimeout(checkInputTimeout);
                }
                checkInputTimeout = setTimeout(function(){
                    // 校验出错
                    if (!cdnUtil.testIp(ip))
                    {
                        $("[_dn_cdn_action='ip_error']").removeClass("hide");
                        $("[_dn_cdn_action='error']").addClass("error");
                    }
                    // 校验正确
                    else {
                        $("[_dn_cdn_action='ip_error']").addClass("hide");
                        $("[_dn_cdn_action='error']").removeClass("error");
                    }
                }, 500);
            });
        };

        // 验证按钮事件
        $verifyBtn.on('click', function(e) {
            var target = $(this);
            if (target.hasClass("disabled")) {
                return;
            }
            var ip = $("[_dn_cdn_action='ip_input']").val().trim();
            if (!cdnUtil.testIp(ip))
            {
                $("[_dn_cdn_action='ip_error']").removeClass("hide");
                $("[_dn_cdn_action='error']").addClass("error");
                $("[_dn_cdn_action='ip_input']").focus();
                return;
            }

            $("[_dn_cdn_action='loading']").removeClass("hide");
            $verifyBtn.addClass("disabled");
            dao.query_cdn_ip({
                data: {
                    ip: ip
                },
                success: {
                    0: function(rs){
                        $("[_dn_cdn_action='loading']").addClass("hide");
                        $verifyBtn.removeClass("disabled");
                        var str = tmpl.parse($("[data-cdn-tmpl=ip_table]").html(), {
                            data : rs.data[0]
                        });
                        $(".tc-15-table-panel").html(str);
                    },
                    default: function(rs) {
                        tips.error(rs.msg || _defaultErrMsg);
                        $verifyBtn.removeClass("disabled");
                    }
                },
                error : function(rs){
                    $("[_dn_cdn_action='loading']").addClass("hide");
                    $verifyBtn.removeClass("disabled");
                    tips.error(rs.msg || _defaultErrMsg);
                }
            });
        });

        initInputEvent();
    };

    return{
        container: queryTemplate,
        init: function(){

            bindEvent();
            
        }
    }
});/*  |xGv00|0b82816478392b58d97fed44e348b409 */