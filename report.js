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
    var reportTemplate = require("../../templates/report.html.js");
    var $reportTemplate = $(reportTemplate);

    var cnameDetailTmpl = $reportTemplate.filter('[_dn_cdn_detail_tmpl="cname"]').html();
    var dnsDetailTmpl = $reportTemplate.filter('[_dn_cdn_detail_tmpl="dns"]').html();
    var linkDetailTmpl = $reportTemplate.filter('[_dn_cdn_detail_tmpl="link"]').html();
    var consistencyDetailTmpl = $reportTemplate.filter('[_dn_cdn_detail_tmpl="consistency"]').html();
    var resultExpTmpl = $reportTemplate.filter('[_dn_cdn_detail_tmpl="result_exp"]').html();
    var linkResultExpTmpl = $reportTemplate.filter('[_dn_cdn_detail_tmpl="link_result_exp"]').html();
    var resultNorTmpl = $reportTemplate.filter('[_dn_cdn_detail_tmpl="result_normal"]').html();
    var linkResultNorTmpl = $reportTemplate.filter('[_dn_cdn_detail_tmpl="link_result_normal"]').html();

    var reportDataTable;
    var reportData;
    var testUrl;

    var initEvent = function() {
        // 返回按钮点击事件
        $('[_dn_cdn_action="return"]').on("click", function(e) {
            router.navigate('/cdn/tools/diagnose/report');
        });
    };

    // 初始化检测结果表格
    var initReportTable = function() {
        var column = [{
            key : 'item',
            name : '诊断项',
            order : false,
            width: "10%"
        }, {
            key : 'status',
            name : '状态',
            order : false,
            width: "10%"
        }, {
            key : 'result',
            name : '诊断结果',
            order : false,
            width: "60%"
        }, {
            key : 'operation',
            name : '操作',
            order : false,
            width: "20%"
        }];
        reportDataTable = Bee.mount('report_data_table', {
            $data : {
                canSelectTotal : true,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示,
                // 表头/列配置
                colums : column,
                maxHeightOffset : 10,// 最大高度的偏移值
                hasFirst: false,
                showPagination: false,
                showState: false,
                autoMaxHeight: false,
                maxHeight: 'auto'
            },
            events: {
                'click [_dn_cdn_action="show_detail"]': function(e) {
                    var target = $(e.target);
                    var rowIndex = target.parents("tr").attr("data-index");
                    var arrowStatus = target.parent().find("i[_dn_cdn_up_icon]").hasClass("hide");
                    var detailPanalId;
                    switch(rowIndex) {
                        case "0":
                            detailPanalId = "_dn_cdn_cname_detail";
                            break;
                        case "1":
                            detailPanalId = "_dn_cdn_dns_detail";
                            break;
                        case "3":
                            detailPanalId = "_dn_cdn_link_detail";
                            break;
                        case "4":
                            detailPanalId = "_dn_cdn_consistency_detail";
                            break;
                    }
                    if (arrowStatus)
                    {
                        $('[' + detailPanalId + ']').removeClass("hide");
                        target.parent().find("i[_dn_cdn_up_icon]").removeClass("hide");
                        target.parent().find("i[_dn_cdn_down_icon]").addClass("hide");
                    }
                    else {
                         $('[' + detailPanalId + ']').addClass("hide");
                        target.parent().find("i[_dn_cdn_up_icon]").addClass("hide");
                        target.parent().find("i[_dn_cdn_down_icon]").removeClass("hide");
                    }
                }
            },
            getCellContent: function(val, item, col) {
                var res = (val !== undefined || val !== "") ? val : "-";
                if (col.key == "result") {
                    if (item.item == "CNAME") {
                        if (item.status == 0)
                        {
                            return '<span class="text-overflow">正常</span>';
                        }
                        else if (item.status == 1) {
                            return tmpl.parse(resultExpTmpl, {
                                resultMsg: "异常"
                            });
                        }
                        else if (item.status == -1) {
                            res = "-";
                        }
                    }
                    else if (item.item == "DNS解析") {
                        if (item.status == 0)
                        {
                            return tmpl.parse(resultNorTmpl, {
                                resultMsg: "当前解析为最优路径"
                            });
                        }
                        else if (item.status == 1) {
                            return tmpl.parse(resultExpTmpl, {
                                resultMsg: "当前解析路径非最优路径"
                            });
                        }
                        else if (item.status == 2) {
                            return tmpl.parse(resultExpTmpl, {
                                resultMsg: "节点IP获取失败"
                            });
                        }
                        else if (item.status == -1) {
                            res = "-";
                        }
                    }
                    else if (item.item == "各站点可用性") {
                        if (item.status == 0)
                        {
                            return '<span class="text-overflow">节点源站连接正常</span>';
                        }
                        else if (item.status == 1) {
                            if (reportData.diagnose_result.usability_info && reportData.diagnose_result.usability_info.length > 0) {
                                res = "";
                                reportData.diagnose_result.usability_info.forEach(function(item, index) {
                                    if (item.usability != "usable") {
                                        if (item.type == "origin") {
                                            res = "节点连接正常，源站IP " + item.ip + " 连接异常</br>";
                                        }
                                        else {
                                            res = "节点连接异常";
                                        }
                                    }
                                });
                            }
                            return '<span class="text-overflow">' + res + '</span>';
                        }
                        else if (item.status == -1) {
                            res = "-";
                        }
                    }
                    else if (item.item == "链路质量") {
                        if (item.status == 0)
                        {
                            return tmpl.parse(linkResultNorTmpl, {
                                resultMsg: "正常",
                                time_cost: reportData.diagnose_result.LinkQuality_info.time_cost
                            });
                        }
                        else if (item.status == 1) {
                            return tmpl.parse(linkResultExpTmpl, {
                                resultMsg: "链路存在异常",
                                time_cost: reportData.diagnose_result.LinkQuality_info.time_cost
                            });
                        }
                        else if (item.status == -1) {
                            res = "-";
                        }
                    }
                    else if (item.item == "数据访问一致性") {
                        if (item.status == 0)
                        {
                            return tmpl.parse(resultNorTmpl, {
                                resultMsg: "正常"
                            });
                        }
                        else if (item.status == 1) {
                            return tmpl.parse(resultExpTmpl, {
                                resultMsg: "源站资源异常"
                            });
                        }
                        else if (item.status == 2) {
                            return tmpl.parse(resultExpTmpl, {
                                resultMsg: "源站数据不一致"
                            });
                        }
                        else if (item.status == 3) {
                            return tmpl.parse(resultExpTmpl, {
                                resultMsg: "CDN资源异常"
                            });
                        }
                        else if (item.status == 4) {
                            return tmpl.parse(resultExpTmpl, {
                                resultMsg: "CDN数据不一致"
                            });
                        }
                        else if (item.status == -1) {
                            res = "-";
                        }
                    }
                }
                else if (col.key == "status") {
                    if (res == 0)
                    {
                        return '<div class=""><i class="n-success-icon"></i></div>';
                    }
                    else if (res > 0) {
                        return '<div class=""><i class="n-close-icon"></i></div>';
                    }
                    else if (res == -1) {
                        res = "-";
                    }
                }
                else if (col.key == "operation") {
                    if (item.item == "CNAME") {
                        if (item.status == 1) {
                            return res = "请您在域名管理厂商处修改CNAME配置";
                        }
                    }
                    else if (item.item == "DNS解析") {
                        if (item.status == 1) {
                            return res = "请您联系腾讯云技术人员排查问题";
                        }
                        else if (item.status == 2) {
                            return res = "请您联系腾讯云技术人员排查问题";
                        }
                    }
                    else if (item.item == "各站点可用性") {
                        if (item.status == 1) {
                            if (item.usability != "usable")
                            {
                                if (item.type == "origin") {
                                    return '请您检查源站';
                                }
                                else {
                                    return '请您联系腾讯云技术人员排查问题';
                                }
                            }
                            else {
                                return '请您联系腾讯云技术人员排查问题';
                            }
                        }
                    }
                    else if (item.item == "链路质量") {
                        if (item.status == 1) {
                            return '请您联系腾讯云技术人员排查问题';
                        }
                    }
                    else if (item.item == "数据访问一致性") {
                        if (item.status == 1) {
                            return '请您检查源站上的资源状态';
                        }
                        else if (item.status == 2) {
                            return '请您检查源站上的资源状态';
                        }
                        else if (item.status == 3) {
                            return '请您联系腾讯云技术人员排查问题';
                        }
                        else if (item.status == 4) {
                            return '您可以调整缓存时间的设定，或进行刷新操作，如不能解决问题，请联系腾讯云技术人员';
                        }
                    }
                    res = "-";
                }
                return '<span class="text-overflow">' +res+ '</span>';
            }
        });

        reportDataTable.setData({
            totalNum : 0,
            page : 1,
            count : 10,
            list :[],
            type:'reload'
        });
    };

    // 查询检测结果
    var getDiagnoseReport = function(tastid) {
        var defer = $.Deferred();
        // TODO
        dao.get_diagnose_report({
            data:{
                task_id: tastid
            },
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                tips.error('获取地域信息数据失败');
                defer.reject(e);
            }
        });
        return defer.promise();
    };

    var setBasicInfo = function() {
        var basicInfo = reportData.diagnose_result.basic_info;
        $('[_dn_cdn_task_id]').text(basicInfo.task_id);
        $('[_dn_cdn_test_url]').text(basicInfo.url);
        $('[_dn_cdn_domain]').text(basicInfo.host);
        $('[_dn_cdn_time]').text(basicInfo.time);
        if (basicInfo.host_type == "cname") {
            $('[_dn_cdn_source_type]').text("自有源");
        }
        else if (basicInfo.host_type == "cos") {
            $('[_dn_cdn_source_type]').text("COS");
        }
        else {
            $('[_dn_cdn_source_type]').text("FTP");
        }
    };

    var setTableData = function() {
        var tableData = [];
        var cnameInfo = {
            item: "CNAME",
            status: reportData.diagnose_status.cname
        };
        var dnsInfo = {
            item: "DNS解析",
            status: reportData.diagnose_status.dns
        };
        var backupStationInfo = {
            item: "各站点可用性",
            status: reportData.diagnose_status.usability
        };
        var linkInfo = {
            item: "链路质量",
            status: reportData.diagnose_status.linkquality
        };
        var consistencyInfo = {
            item: "数据访问一致性",
            status: reportData.diagnose_status.consistency
        };
        tableData.push(cnameInfo, dnsInfo, backupStationInfo, linkInfo, consistencyInfo);
        reportDataTable.setData({
            totalNum : 0,
            page : 1,
            count : 5,
            list :tableData,
            type:'reload'
        });
        if (reportData.diagnose_result.cname_info)
        {
            $(".tc-15-table-fixed-body").find('tr.item-row[data-index="0"]').after(tmpl.parse(cnameDetailTmpl, reportData.diagnose_result));
        }
        if (reportData.diagnose_result.DNS_info)
        {
            $(".tc-15-table-fixed-body").find('tr.item-row[data-index="1"]').after(tmpl.parse(dnsDetailTmpl, {
                userAgent: cdnUtil.getBrowserInfo(),
                DNS_info: reportData.diagnose_result.DNS_info,
                diagnose_status: reportData.diagnose_status.dns
            }));
        }
        if (reportData.diagnose_result.LinkQuality_info)
        {
            $(".tc-15-table-fixed-body").find('tr.item-row[data-index="3"]').after(tmpl.parse(linkDetailTmpl, reportData.diagnose_result));
        }
        if (reportData.diagnose_result.consistency_info)
        {
            $(".tc-15-table-fixed-body").find('tr.item-row[data-index="4"]').after(tmpl.parse(consistencyDetailTmpl, reportData.diagnose_result));
        }
    };

    var refresh = function(tastid) {
        getDiagnoseReport(tastid).done(function(rs) {
            if (rs.code == 0) {
                reportData = rs.data;
                setBasicInfo();
                setTableData();
            }
            else {
                tips.error(rs.msg || helper._defaultErrMsg);
            }
        }).fail(function(rs) {
            tips.error(rs.msg || helper._defaultErrMsg);
        });
    };

    return {
        container: reportTemplate,
        init: function(tastid){
            initReportTable();

            initEvent();

            refresh(tastid);
        }
    };
});/*  |xGv00|c8da5cb0ded09e36cc44acac414b5b75 */