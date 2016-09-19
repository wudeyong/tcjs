define(function(require, exports, module) {
    var $ = require("cdn/$");
    var _ = require("cdn/lib/underscore");
    var Bee = require('qccomponent');
    var tmpl = require("cdn/lib/tmpl");
    var dao = require('cdn/data/dao');
    var util = require('cdn/util');
    var cdnutil = require('cdn/lib/util');
    var router = require("cdn/router");
    var tips = require('cdn/tips');
    var dropdown = require('cdn/dropdown');
    var guidTemplate = require("../../templates/guid_oversea.html.js");
    require("cdn/lib/placeholder");

    var $guidTemplate = $(guidTemplate);
    var projectSelectTmpl = $guidTemplate.filter("#project_select").html();
    var cacheRowTmpl = $guidTemplate.filter("#cache_row").html();
    var cacheConfirmTmpl = $guidTemplate.filter("#cache_confirm").html();

    var _defaultErrMsg = '服务器繁忙，请稍后再试';
    var step;
    var hostData;
    // 用于判断回源host是否为默认值，是默认值，即用户没有手动修改过，则输入框的值会跟随域名合法值变化
    var fwdDefault;

    var initPage = function() {
        // 初始化作用域变量
        step = 1;
        hostData = {
            host: "",
            origin: "",
            host_type: "cname",
            project_id: "",
            service_type: "web",
            cache: "",
            fwd_host: "",
            furl_cache: "on",
            refer: {
                type: 0,
                list: []
            }
        };
        fwdDefault = true;

        // 兼容ie9
        $("[_dn_cdn_domain_input]").placeholder('请输入域名');
        $("[_dn_cdn_origin_input]").placeholder('可填写一个源站IP或IP:port，或可填一个域名或域名:port；端口只能为80;IP不能填内网IP');
        // $("[_dn_cdn_fwd_input]").placeholder('请输入回源host');
        // $("[_dn_cdn_referer_input_black]").placeholder('不需要输入网址符http://，回车换行，一行输入一个');
        // $("[_dn_cdn_referer_input_white]").placeholder('不需要输入网址符http://，回车换行，一行输入一个');

        // 初始化类型列表
        new dropdown($('[_dn_cdn_service_type]'), {
            buttonObj: $('[_dn_cdn_service_type]').find('a')
        }).click(function($li) {
            var service_type = $li.data("val");
            $('[_dn_cdn_service_type_selected]').text($li.text()).attr("data-val", service_type);
            hostData.service_type = service_type;
            $('[_dn_cdn_service_type_confirm]').text($li.text());
        });

        // 初始化黑白名单下拉框
        new dropdown($('[_dn_cdn_referer]'), {
            buttonObj: $('[_dn_cdn_referer]').find('a')
        }).click(function($li) {
            var referer_type = $li.data("val");
            $('[_dn_cdn_referer_selected]').text($li.text()).attr("data-val", referer_type);
            hostData.refer.type = referer_type;
            if (referer_type == 0) {
                $('[_dn_cdn_referer_input]').addClass("hide");
                $('[_dn_cdn_referer_confirm]').html('referer为空')
            }
            else if (referer_type == 1) {
                $('[_dn_cdn_referer_input]').removeClass("hide");
                $('[_dn_cdn_referer_input_black]').removeClass("hide");
                $('[_dn_cdn_referer_input_white]').addClass("hide");
                $('[_dn_cdn_referer_confirm]').html('refer黑名单:<br>' + hostData.refer.list.join(','));
            }
            else {
                $('[_dn_cdn_referer_input]').removeClass("hide");
                $('[_dn_cdn_referer_input_white]').removeClass("hide");
                $('[_dn_cdn_referer_input_black]').addClass("hide");
                $('[_dn_cdn_referer_confirm]').html('refer白名单:<br>' + hostData.refer.list.join(','));
            }
        });

        // 初始化项目列表
        getProjectList().done(function(rs) {
            hostData.project_id = rs.data.projects[0].id;
            $('[_dn_cdn_project_confirm]').text(rs.data.projects[0].name);
            var projectHtml = tmpl.parse(projectSelectTmpl, {projects: rs.data.projects});
            $("[_dn_cdn_projects]").replaceWith(projectHtml);
            new dropdown($('[_dn_cdn_projects]'), {
                buttonObj: $('[_dn_cdn_projects]').find('a')
            }).click(function($li) {
                var projectId = $li.data("val");
                $('[_dn_cdn_project_selected]').text($li.text()).attr("data-val", projectId);
                hostData.project_id = projectId;
                $('[_dn_cdn_project_confirm]').text($li.text());
            });
        }).fail(function() {

        });

        // 初始化缓存设置默认配置
        getCacheData();
    };

    var initEvent = function() {
        // 取消按钮
        $('[_dn_cdn_cancel]').on("click", function(e) {
            router.navigate("/cdn/access_oversea");
        });

        // 下一步按钮
        $('[_dn_cdn_next_step]').on("click", function(e) {
            if (step == 1) {
                if (!hostData.host) {
                    $("[_dn_cdn_domain_input]").focus();
                    $("[_dn_cdn_domain_input]").parent().addClass("error");
                    return;
                }
                if (!hostData.origin) {
                    $("[_dn_cdn_origin_input]").focus();
                    $("[_dn_cdn_origin_input]").addClass("error");
                    return;
                }
                if (!hostData.fwd_host) {
                    $("[_dn_cdn_fwd_input]").focus();
                    $("[_dn_cdn_fwd_input]").parent().addClass("error");
                    return;
                }
                $('[_dn_cdn_step_control]').removeClass("hide");
            }
            if (step == 2) {
                var isError = false;
                $('[_dn_cdn_cache_custom_row] input').each(function() {
                    var item = $(this);
                    if (!item.val() || item.hasClass("error")) {
                        item.addClass("error");
                        item.focus();
                        isError = true;
                        return false;
                    }
                });
                if (hostData.refer.type != 0 && $('[_dn_cdn_referer_input]').hasClass("error")) {
                    $('[_dn_cdn_referer_input] textarea').focus();
                    isError = true;
                }
                if (isError) {
                    return;
                }
                $('[_dn_cdn_next_step]').text("提交");
            }
            if (step == 3) {
                hostData.refer = JSON.stringify(hostData.refer);
                addHost(hostData).done(function(rs) {
                    // 步骤进度变化
                    $("[_dn_cdn_stepbar_step3]").removeClass("actived");
                    $("[_dn_cdn_stepbar_step3]").addClass("finish");
                    $("[_dn_cdn_stepbar_step4]").addClass("actived");
                    // 该步骤内容展示
                    $("[_dn_cdn_step3").addClass("hide");
                    $("[_dn_cdn_step4]").removeClass("hide");
                    $('[_dn_cdn_step_control]').addClass("hide");
                    // 成功显示
                    $('[_dn_cdn_step4_success_host]').text(hostData.host + '已完成添加，请稍等几分钟，系统正在为您分配CDN域名。')
                    $('[_dn_cdn_step4_success]').removeClass("hide");
                    $('[_dn_cdn_step4_fail]').addClass("hide");
                }).fail(function(rs) {
                    // 步骤进度变化
                    $("[_dn_cdn_stepbar_step3]").removeClass("actived");
                    $("[_dn_cdn_stepbar_step3]").addClass("finish");
                    $("[_dn_cdn_stepbar_step4]").addClass("actived");
                    // 该步骤内容展示
                    $("[_dn_cdn_step3").addClass("hide");
                    $("[_dn_cdn_step4]").removeClass("hide");
                    $('[_dn_cdn_step_control]').addClass("hide");
                    // 失败显示
                    $('[_dn_cdn_step4_success]').addClass("hide");
                    $('[_dn_cdn_step4_fail]').removeClass("hide");
                });
                step++
                return;
            }
            // 步骤进度变化
            $("[_dn_cdn_stepbar_step" + step + "]").removeClass("actived");
            $("[_dn_cdn_stepbar_step" + step + "]").addClass("finish");
            $("[_dn_cdn_stepbar_step" + (step + 1) + "]").addClass("actived");
            // 该步骤内容展示
            $("[_dn_cdn_step" + step + "]").addClass("hide");
            $("[_dn_cdn_step" + (step + 1) + "]").removeClass("hide");
            step++;
        });

        // 上一部按钮
        $('[_dn_cdn_pre_step]').on("click", function(e) {
            // 步骤进度变化
            $("[_dn_cdn_stepbar_step" + step + "]").removeClass("actived");
            $("[_dn_cdn_stepbar_step" + (step - 1) + "]").removeClass("finish");
            $("[_dn_cdn_stepbar_step" + (step - 1) + "]").addClass("actived");
            // 该步骤内容展示
            $("[_dn_cdn_step" + step + "]").addClass("hide");
            $("[_dn_cdn_step" + (step - 1) + "]").removeClass("hide");
            // 上一步下一步按钮变化
            $('[_dn_cdn_next_step]').text("下一步");
            step--;
            if (step == 1) {
                $('[_dn_cdn_step_control]').addClass("hide");
            }
        });

        var checkHostTimeout;
        // 域名输入事件
        $('[_dn_cdn_domain_input]').on("keyup", function(e) {
            // 清空校验定时器
            if (checkHostTimeout) {
                clearTimeout(checkHostTimeout);
            }
            var target = $(e.target);
            // 清除成功提示
            target.parent().removeClass("succeed");
            var domainInput = $.trim(target.val());
            if (!domainInput)
            {   
                hostData.host = "";
                if (fwdDefault) {
                    $('[_dn_cdn_fwd_input]').val("");
                    $('[_dn_cdn_fwd_input]').parent().removeClass("error");
                    $('[_dn_cdn_fwd_input_tip]').addClass("hide");
                }
                return;
            }
            checkHostTimeout = setTimeout(function() {
                // 转菊花
                $('[_dn_cdn_loading]').removeClass("hide");
                // 校验域名格式
                if (!cdnutil.testDomain(domainInput)) {
                    $('[_dn_cdn_domain_input_tip]').text("域名格式不正确");
                    $('[_dn_cdn_domain_input_tip]').removeClass("hide");
                    target.parent().addClass("error");
                    // 隐藏转菊花
                    $('[_dn_cdn_loading]').addClass("hide");
                    hostData.host = "";
                    if (fwdDefault) {
                        $('[_dn_cdn_fwd_input]').val("");
                        $('[_dn_cdn_fwd_input]').parent().removeClass("error");
                        $('[_dn_cdn_fwd_input_tip]').addClass("hide");
                    }
                    return;
                }
                // 后端校验域名
                checkHost(domainInput).done(function(rs) {
                    // 校验成功提示
                    target.parent().addClass("succeed");
                    target.parent().removeClass("error");
                    $('[_dn_cdn_loading]').addClass("hide");
                    $('[_dn_cdn_domain_input_tip]').addClass("hide");
                    // 隐藏转菊花
                    $('[_dn_cdn_loading]').addClass("hide");
                    hostData.host = domainInput;
                    hostData.fwd_host = domainInput;
                    if (fwdDefault) {
                        $('[_dn_cdn_fwd_input]').val(domainInput);
                        $('[_dn_cdn_fwd_input]').parent().removeClass("error");
                        $('[_dn_cdn_fwd_input_tip]').addClass("hide");
                    }
                    $('[_dn_cdn_domain_confirm]').text(hostData.host);
                    $('[_dn_cdn_fwd_confirm]').text(hostData.fwd_host);
                }).fail(function(rs) {
                    // 校验失败提示
                    target.parent().addClass("error");
                    target.parent().removeClass("succeed");
                    $('[_dn_cdn_domain_input_tip]').text(rs.msg);
                    $('[_dn_cdn_domain_input_tip]').removeClass("hide");
                    // 隐藏转菊花
                    $('[_dn_cdn_loading]').addClass("hide");
                    hostData.host = "";
                    if (fwdDefault) {
                        $('[_dn_cdn_fwd_input]').val("");
                        $('[_dn_cdn_fwd_input]').parent().removeClass("error");
                        $('[_dn_cdn_fwd_input_tip]').addClass("hide");
                    }
                });
            }, 500);
        });

        // 源站IP输入事件
        $('[_dn_cdn_origin_input]').on("keyup", function(e) {
            var target = $(e.target);
            var origin = $.trim(target.val());
            if (!origin)
            {
                $('[_dn_cdn_origin_input_tip]').removeClass("hide");
                $('[_dn_cdn_origin_input]').addClass("error");
                hostData.origin = "";
                return;
            }
            if (!(cdnutil.testIpAndPort(origin) && cdnutil.checkIntranet(origin)) && !cdnutil.testDomainAndPort(origin)) {
                $('[_dn_cdn_origin_input_tip]').removeClass("hide");
                $('[_dn_cdn_origin_input]').addClass("error");
                hostData.origin = "";
                return;
            }
            if (origin.split(":")[1] && origin.split(":")[1] != "80") {
                $('[_dn_cdn_origin_input_tip]').removeClass("hide");
                $('[_dn_cdn_origin_input]').addClass("error");
                hostData.origin = "";
                return;
            }
            $('[_dn_cdn_origin_input_tip]').addClass("hide");
            $('[_dn_cdn_origin_input]').removeClass("error");
            hostData.origin = origin;
            $('[_dn_cdn_origin_confirm]').text(origin);
        });

        // 回源host输入事件
        $('[_dn_cdn_fwd_input]').on("keyup", function(e) {
            var target = $(e.target);
            var fwd = $.trim(target.val());
            if (!cdnutil.testDomain(fwd)) {
                hostData.fwd_host = "";
                target.parent().addClass("error");
                $('[_dn_cdn_fwd_input_tip]').removeClass("hide");
                fwdDefault = true;
                return;
            }
            target.parent().removeClass("error");
            $('[_dn_cdn_fwd_input_tip]').addClass("hide");
            hostData.fwd_host = fwd || hostData.host;
            fwdDefault = false;
            $('[_dn_cdn_fwd_confirm]').text(hostData.fwd_host);
        });

        // 伸缩面板点击事件
        $('.ico-down-arrow').on("click", function(e) {
            $(this).parents(".step-process-box").toggleClass("open");
        });

        // 过滤参数勾选事件
        $('[_dn_cdn_param_filter]').on("change", function(e) {
            if ($(this).prop("checked") == true) {
                hostData.furl_cache = "off";
                $('[_dn_cdn_basic_confirm]').removeClass("hide");
            }
            else {
                hostData.furl_cache = "on";
                $('[_dn_cdn_basic_confirm]').addClass("hide");
            }
        });

        // 缓存设置新增一列按钮
        $('[_dn_cdn_cache_add]').on("click", function(e) {
            var cacheRow = tmpl.parse(cacheRowTmpl, {});

            var defaultRow = $('[_dn_cdn_cache_default_row]');
            var customRow = $('[_dn_cdn_cache_custom_row]');
            if (customRow.length > 0) {
                customRow.eq(customRow.length - 1).after(cacheRow);
                //兼容ie9
                $(cacheRow).find("[_dn_cdn_cache_file_input]").placeholder('.jpg;.png;.js');
            }
            else {
                defaultRow.after(cacheRow);
            }
            if (customRow.length == 8) {
                $('[_dn_cdn_cache_add]').parent().hide();
            }
            else {
                $('[_dn_cdn_cache_add]').parent().show();
            }
            $('[_dn_cdn_cache_delete]').off('click').on("click", function(e) {
                $(this).parents("[_dn_cdn_cache_custom_row]").remove();
            });
            $('[_dn_cdn_cache_file_input]').off('keyup').on("keyup", function(e) {
                var testReg = /^((\.[a-zA-Z0-9]{1,});)*\.[a-zA-Z0-9]{1,}$/;
                var value = $.trim($(this).val());
                if (!value || !testReg.test(value)) {
                    $(this).addClass("error");
                }
                else {
                    $(this).removeClass("error");
                    getCacheData()
                }
            });
            $('[_dn_cdn_cache_time_input]').off('keyup').on("keyup", function(e) {
                var value = $.trim($(this).val());
                var selectVal = $(this).next().val();
                if (value == "" || isNaN(+value)) {
                    $(this).addClass("error");
                }
                else {
                    if (selectVal == "d") {
                        value = +value * 86400;
                    }
                    else if (selectVal == "h") {
                        value = +value * 3600;
                    }
                    else if (selectVal == "m") {
                        value = +value * 60;
                    }
                    if (value > 31536000) {
                        $(this).addClass("error");
                        return;
                    }
                    $(this).removeClass("error");
                    getCacheData();
                }
            });
        });

        // 防盗链输入
        $('[_dn_cdn_referer_input] textarea').on("keyup", function(e) {
            var inputValue = $(this).val();
            var inputArr = this.value.split(/\n/);
            var isError = false;
            for (var i = 0; i < inputArr.length; i++) {
                if (!$.trim(inputArr[i]))
                {
                    inputArr.splice(i, 1);
                    i--;
                }
                else if (!cdnutil.testDomain($.trim(inputArr[i])) && !cdnutil.testIp($.trim(inputArr[i]))) {
                    $('[_dn_cdn_referer_input]').addClass("error");
                    isError = true;
                    break;
                }
            }
            if (inputArr.length > 400) {
                $('[_dn_cdn_referer_number]').text(0);
                $('[_dn_cdn_referer_input]').addClass("error");
                isError = true;
            }
            else {
                $('[_dn_cdn_referer_number]').text(400 - inputArr.length);
            }
            if (!isError) {
                $('[_dn_cdn_referer_input]').removeClass("error");
            }
            hostData.refer.list = inputArr;
            if (hostData.refer.type == 0) {
                $('[_dn_cdn_referer_confirm]').html('referer为空')
            }
            else if (hostData.refer.type == 1) {
                $('[_dn_cdn_referer_confirm]').html('refer黑名单:<br>' + hostData.refer.list.join(','));
            }
            else {
                $('[_dn_cdn_referer_confirm]').html('refer白名单:<br>' + hostData.refer.list.join(','));
            }
        });

        // 添加成功后点击跳转到接入管理
        $('[_dn_cdn_router_access]').on("click", function(e) {
            router.navigate("/cdn/access_oversea");
        });

        // 添加失败后返回上一步
        $('[_dn_cdn_return_step]').on("click", function(e) {
            // 步骤进度变化
            $("[_dn_cdn_stepbar_step" + step + "]").removeClass("actived");
            $("[_dn_cdn_stepbar_step" + (step - 1) + "]").removeClass("finish");
            $("[_dn_cdn_stepbar_step" + (step - 1) + "]").addClass("actived");
            // 该步骤内容展示
            $("[_dn_cdn_step" + step + "]").addClass("hide");
            $("[_dn_cdn_step" + (step - 1) + "]").removeClass("hide");
            // 上一步下一步按钮变化
            $('[_dn_cdn_next_step]').text("下一步");
            $('[_dn_cdn_step_control]').removeClass("hide");
            step--;
        });
    };

    var getCacheData = function() {
        var cache = [];
        var customRow = $('[_dn_cdn_cache_custom_row]');
        cache.push([0, "all", "2592000", "d"]);
        customRow.each(function(index, item) {
            var $item = $(item);
            var time = $item.find('[_dn_cdn_cache_time_input]').val();
            var unit = $item.find('[_dn_cdn_cache_time_select]').val();
            if (unit == "d") {
                time = time * 86400;
            }
            else if (unit == "h") {
                time = time * 3600;
            }
            else if (unit == "m") {
                time = time * 60;
            }
            cache.push([1, $item.find('[_dn_cdn_cache_file_input]').val(), time, unit]);
        });
        hostData.cache = JSON.stringify(cache);
        $('[_dn_cdn_cache_confirm]').replaceWith(tmpl.parse(cacheConfirmTmpl, {cache: cache}));
    };

    var getProjectList = function() {
        var defer = $.Deferred();
        dao.getProjectList({
            data: {},
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    if (rs.msg) {
                        tips.error(rs.msg);
                    } else {
                        tips.error(_defaultErrMsg);
                    }
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var checkHost = function(host) {
        var defer = $.Deferred();
        dao.checkHostOv({
            data: {
                host: host
            },
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var addHost = function(data) {
        var defer = $.Deferred();
        dao.addHostOv({
            data: data,
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    if (rs.msg) {
                        tips.error(rs.msg);
                    } else {
                        tips.error(_defaultErrMsg);
                    }
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };


    return {
        container: guidTemplate,
        render: function() {
            initPage();
            initEvent();
        },
        destroy: function() {
            
        }
    };
});
/*  |xGv00|9cbfa9f9a01055748b116ad11360c41b */