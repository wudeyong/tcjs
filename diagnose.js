/**
* @CDN节点IP查找管理模块
* @author brandonwei
* @requires jQuery
* @update 2016-02-25
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var Bee = require('qccomponent');
    var router = require("cdn/router");
    var tmpl = require("cdn/lib/tmpl");
    var dateUtil = require('cdn/lib/date');
    var dao = require('cdn/data/dao');
    var dialog = require('cdn/dialog');
    var ajaxPostForm = require('cdn/lib/ajaxPostForm');
    var tips = require('cdn/tips');
    var util = require('cdn/util');
    var helper = require('cdn/data/helper');
    var cdnUtil = require('cdn/lib/util');
    var debugTemplate = require("../../templates/diagnose.html.js");

    var reportListTable;
    var reportList = [];
    var taskId;
    var hostId;
    var appId = $.cookie("cdn_appid");
    var testUrl;
    var testUrlForClient;
    var localdnsUrl;
    var linkIpList = [];

    var checkReportInterval;

    var initEvent = function() {
        var urlReg = /^(http)(:\/\/)(.+)(\.[^\.]+)$/;
        // tab点击事件
        $('[_dn_cdn_action$="tab"]').on("click", function(e) {
            var target = $(this);
            var tabName = target.attr("_dn_cdn_action");
            var panel = tabName.replace("tab", "panel");
            $('[_dn_cdn_action$="panel"]').addClass("hide");
            $('[_dn_cdn_action$="' + panel + '"]').removeClass("hide");

            $('[_dn_cdn_action$="tab"]').removeClass("tc-cur");
            target.addClass("tc-cur");
            if (tabName == "debug_report_tab")
            {
                refresh("report");
            }
        });

        $('[_dn_cdn_report]').on('click', function(e) {
            $('[_dn_cdn_action$="panel"]').addClass("hide");
            $('[_dn_cdn_action="debug_report_panel"]').removeClass("hide");
            $('[_dn_cdn_action$="tab"]').removeClass("tc-cur");
            $('[_dn_cdn_action="debug_report_tab"]').addClass("tc-cur");
            refresh("report");
        });

        // 诊断按钮点击事件
        $('[_dn_cdn_action="test_btn"]').on("click", function(e) {
            var testBtn = $(this);
            testUrl = $.trim($('[_dn_cdn_action="test_url_self"]').val());
            if (!testUrl)
            {
                $('[_dn_cdn_action="test_url_self"]').parent().addClass("is-error");
                $('[_dn_cdn_error_self]').text("您输入的URL为空。");
                $('[_dn_cdn_error_self]').removeClass("hide");
                return;
            }
            if (!urlReg.test(testUrl))
            {
                $('[_dn_cdn_action="test_url_self"]').parent().addClass("is-error");
                $('[_dn_cdn_error_self]').text("您输入的URL格式有误。");
                $('[_dn_cdn_error_self]').removeClass("hide");
                return;
            }
            $('[_dn_cdn_error_self]').addClass("hide");
            $('[_dn_cdn_action="test_url_self"]').parent().removeClass("is-error");
            // 灰化按钮
            testBtn.addClass("disabled");
            testBtn.attr("disabled", true);
            // 添加检测url
            submitDiagnose(testUrl).done(function(rs) {
                // 添加成功，发起检测
                if (rs.code == 0) {
                    // 提交任务成功提示
                    tips.success("您的诊断请求已提交，请点击诊断链接进行诊断");
                    // 亮化按钮
                    testBtn.removeClass("disabled");
                    testBtn.attr("disabled", false);
                    // 清空输入框
                    $('[_dn_cdn_action="test_url_self"]').val("");

                    taskId = rs.data.task_id;
                    hostId = rs.data.host_id;
                    localdnsUrl = "http://" + rs.data.random_domain;
                    var url = "http:" + CDN.FormSender.serverUrl + "/diagnose/ajax/diagnose.php?action=self_diagnose&random_domain=" + localdnsUrl + "&test=" + testUrl + "&task_id=" + taskId + "&host_id=" + hostId + "&app_id=" + appId
                    $('[_dn_cdn_test_url]').replaceWith('<a href="javascript:void(0)" target="_blank" _dn_cdn_test_url></a>');
                    $('[_dn_cdn_test_url]').text(localdnsUrl);
                    $('[_dn_cdn_test_url]').attr("href", url);
                    // window.open("http:" + CDN.FormSender.serverUrl + "/diagnose/ajax/diagnose.php?action=self_diagnose&random_domain=" + localdnsUrl + "&test=" + testUrl + "&task_id=" + taskId + "&host_id=" + hostId + "&app_id=" + appId, "_blank", "width=600, height=400");
                    checkReportInterval = setInterval(function() {
                        getDiagnoseStatus(taskId).done(function(rs) {
                            if (rs.code == 0 && rs.data.status > 1) {
                                clearInterval(checkReportInterval);
                                refresh();
                            }
                        });
                    }, 10 * 1000);
                }
                else {
                    tips.error(rs.msg || helper._defaultErrMsg);
                    // 亮化按钮
                    testBtn.removeClass("disabled");
                    testBtn.attr("disabled", false);
                }
            });
        });

        // 获取诊断url按钮点击事件
        $('[_dn_cdn_action="get_test_url_btn"]').on("click", function(e) {
            var testBtn = $(this);
            testUrl = $.trim($('[_dn_cdn_action="test_url_client"]').val());
            if (!testUrl)
            {
                $('[_dn_cdn_action="test_url_self"]').parent().addClass("is-error");
                $('[_dn_cdn_error_client]').text("您输入的URL为空。");
                $('[_dn_cdn_error_client]').removeClass("hide");
                return;
            }
            if (!urlReg.test(testUrl))
            {
                $('[_dn_cdn_action="test_url_client"]').parent().addClass("is-error");
                $('[_dn_cdn_error_client]').text("您输入的URL格式有误。");
                $('[_dn_cdn_error_client]').removeClass("hide");
                return;
            }
            $('[_dn_cdn_error_client]').addClass("hide");
            $('[_dn_cdn_action="test_url_client"]').parent().removeClass("is-error");
            // 灰化按钮
            testBtn.addClass("disabled");
            testBtn.attr("disabled", true);
            submitSubDiagnose(testUrl).done(function(rs) {
                if (rs.code == 0) {
                    // 提交任务成功提示
                    tips.success("您的诊断请求已提交。");
                    // 清空输入框
                    $('[_dn_cdn_action="test_url_client"]').val("");

                    testUrlForClient = rs.data.diagnose_url;
                    hostId = rs.data.host_id;
                    $('[_dn_cdn_action="client_test_url"]').text(testUrlForClient);
                }
                else {
                    // 提交错误
                    tips.error(rs.msg || helper._defaultErrMsg);
                }
                // 亮化按钮
                testBtn.removeClass("disabled");
                testBtn.attr("disabled", false);
            }).fail(function(rs) {
                tips.error(rs.msg || helper._defaultErrMsg);
                // 亮化按钮
                testBtn.removeClass("disabled");
                testBtn.attr("disabled", false);
            });
        });

        // 搜索按钮点击事件
        $('[_dn_cdn_action="search_btn"]').on("click", function(e) {
            var inputValue = $.trim($('[_dn_cdn_search_value]').val());
            setTableData(reportList, inputValue);
        });

        // 支持按回车搜索
        $('[_dn_cdn_search_value]').on("keyup", function(e) {
            if (e.keyCode == 13 || e.keyCode == 108) {
                var inputValue = $.trim($('[_dn_cdn_search_value]').val());
                setTableData(reportList, inputValue);
            }
        });
    };

    var initReportTable = function() {
        var column = [{
            key : 'id',
            name : '报告ID',
            order : false,
            width: "10%"
        }, {
            key : 'domain',
            name : 'URL域名',
            order : false,
            width: "30%"
        }, {
            key : 'ip',
            name : '访问IP',
            order : false,
            width: "10%"
        }, {
            key : 'region',
            name : '访问区域',
            order : false,
            width: "10%"
        }, {
            key : 'time',
            name : '访问时间',
            order : false,
            width: "10%"
        }, {
            key : 'type',
            name : '诊断来源',
            order : false,
            width: "10%"
        }, {
            key : 'status',
            name : '状态',
            order : false,
            width: "10%"
        }, {
            key : 'operation',
            name : '操作',
            order : false,
            width: "10%"
        }];
        reportTable = Bee.mount('report_table', {
            $data : {
                canSelectTotal : true,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示,
                // 表头/列配置
                colums : column,
                maxHeightOffset : 10,// 最大高度的偏移值
                hasFirst: false
            },
            events: {
                'click tr a[_dn_cdn_action="report_detail"]': function(e) {
                    var id = $(e.target).attr('_dn_cdn_data');
                    router.navigate('/cdn/tools/diagnose/report/' + id);
                },
                'click tr a[ _dn_cdn_action="copy_link"]': function(e) {
                    var value = "http://cdn.qcloud.com/report/" + $(e.target).attr('_dn_cdn_data');
                    var input = $('<input type="text">');
                    input.val(value)
                    $("body").append(input);
                    input[0].select();
                    document.execCommand('copy');
                    input.remove();
                    tips.success("链接已复制到剪切板");
                }
            },
            getCellContent: function(val, item, col) {
                var res = (val !== undefined || val !== "") ? val : "-";
                if (col.key == "operation")
                {
                    return '<a href="javascript:void(0)" _dn_cdn_action="report_detail" _dn_cdn_data="' + item.id + '">查看</a><a href="javascript:void(0)" _dn_cdn_action="copy_link" _dn_cdn_data="' + item.report_id + '">复制链接</a>';
                }
                else if (col.key == "type") {
                    if (res == 0) {
                        return '<span class="text-overflow">本机接入诊断</span>';
                    }
                    else {
                        return '<span class="text-overflow">用户接入诊断</span>';
                    }
                } 
                else if (col.key == "status") {
                    if (res == 1) {
                        return '<span class="text-overflow text-danger">异常</span>';
                    }
                    else {
                        return '<span class="text-overflow">正常</span>';
                    }
                }
                else if (col.key == "domain")
                {
                    return '<span class="text-overflow">' + cdnUtil.encodeHTML(res) + '</span>';
                }
                return '<span class="text-overflow">' + res + '</span>';
            },
            getData: function(opts) {
                var res = reportList || [];
                var page = opts.page;
                var count = opts.count;
                var inputValue = $.trim($('[_dn_cdn_search_value]').val());

                if(!opts.type){
                    setTableData(res, inputValue, page, count);
                } 
            }
        });

        reportTable.setData({
            totalNum : 0,
            page : 1,
            count : 10,
            list :[],
            type:'reload'
        });
    };

    // 添加检测域名
    var submitDiagnose = function(url) {
        var defer = $.Deferred();
        dao.submit_diagnose({
            data:{
                url: url
            },
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                defer.reject(e);
            }
        });
        return defer.promise();
    };

    // 添加玩家诊断任务
    var submitSubDiagnose = function(url) {
        var defer = $.Deferred();
        dao.submit_sub_diagnose({
            data:{
                url: url
            },
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                defer.reject(e);
            }
        });
        return defer.promise();
    };

    // 获取被检测域名的部署状态
    var getHostInfo = function(hostId) {
        var defer = $.Deferred();
        dao.getHostInfo({
            data: {
                host_id: hostId
            },
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                defer.reject(e);
            }
        });
        return defer.promise();
    };

    // 获取检测进度
    var getDiagnoseStatus = function(taskId) {
        var defer = $.Deferred();
        dao.get_diagnose_status({
            data: {
                task_id: taskId
            },
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                defer.reject(e);
            }
        });
        return defer.promise();
    }

    // 获取检测报告列表
    var getReportList = function() {
        var defer = $.Deferred();
        // TODO
        dao.get_diagnose_list({
            data:{},
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                defer.reject(e);
            }
        });
        return defer.promise();
    };

    // 上报链路信息
    var linkInfoReport = function(param) {
        var defer = $.Deferred();
        // TODO
        dao.linkinfo_report({
            data:param,
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                defer.reject(e);
            }
        });
        return defer.promise();
    };

    var setTableData = function(originData, inputValue, page, count) {
        inputValue = inputValue || "";
        page = page || 1;
        count = count || 10;
        var tableData = $.map(originData, function(item, index, inputValue) {
            if (item.url.indexOf(inputValue) > -1) {
                return {
                    id: item.task_id,
                    domain: item.url,
                    ip: item.ip,
                    time: item.create_time,
                    region: item.prov_name,
                    status: item.final_diagnose,
                    type: item.sub_diagnose,
                    report_id: item.report_id
                }
            }
        }, inputValue);

        reportTable.setData({
            totalNum : tableData.length,
            page : page,
            count : count,
            list : tableData.slice(count * (page - 1), count * page),
            type:'reload'
        });
    };

    var refresh = function(tabId) {
        // 兼容从报告页面返回诊断页面的场景，展示报告tab
        if (tabId == "report") {
            $('[_dn_cdn_action="debug_report_panel"]').removeClass("hide");
            $('[_dn_cdn_action="debug_report_tab"]').addClass("tc-cur");
        }
        else {
            $('[_dn_cdn_action="self_debug_panel"]').removeClass("hide");
            $('[_dn_cdn_action="self_debug_tab"]').addClass("tc-cur");
        }

        getReportList().done(function(rs) {
            if (rs.code == 0) {
                reportList = rs.data.list;
                setTableData(reportList);
                if (reportList.length == 0 || reportList[0].status == 2) {
                    $('[_dn_cdn_action="test_btn"]').removeClass("disabled");
                    $('[_dn_cdn_action="test_btn"]').attr("disabled", false);
                }
            }
        }).fail(function(rs) {

        });
    };

    return {
        container: debugTemplate,
        init: function(tabId){
            initReportTable();

            initEvent();

            refresh(tabId);
        }
    };
});/*  |xGv00|f636e2365b7c5baf3d52bb4f71e9ab50 */