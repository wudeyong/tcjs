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
    var dialog = require('cdn/dialog');
    var ajaxPostForm = require('cdn/lib/ajaxPostForm');
    var tips = require('cdn/tips');
    var util = require('cdn/util');
    var cdnUtil = require('cdn/lib/util');
    var certificateTemplate = require("../../templates/certificate.html.js");

    var _defaultErrMsg = '服务器繁忙，请稍后再试';
    // 证书表格
    var certificateTable;
    // 表格里的数据
    var certificateTableData;
    // 证书列表缓存
    var certList;
    // 域名列表缓存
    var hostList = {
        hosts: []
    };

    var initTable = function() {
        var tableColums = [{
            key : 'host',
            name : '域名'
        }, {
            key : 'source',
            name : '证书来源',           
        }, {
            key : 'status',
            name : '证书状态'
        }, /*{
            key : 'https',
            name : '强制https',
            order : true,
            orderField : 'https'
        },**/ {
            key : 'type',
            name : '回源方式'
        }, {
            key : 'deploy_time',
            name : '部署时间'
        }, {
            key : 'expired_time',
            name : '到期时间'
        }, {
            key : 'operation',
            name : '操作'
        }];

        certificateTable = Bee.mount('certificateTable', {
            events: {
                // 编辑按钮点击事件
                "click tr a[_dn_cdn_action='modify']": function(e) {
                    var index = $(e.target).parents("tr").data("index");
                    var lineData = this.$data.list[index];
                    dialog.create(tmpl.parse($('[_dn_cdn_tmpl="modify_certificate"]').html(), {data: lineData}), 580, '', {
                        title: '修改证书',
                        struct: "rich",
                        onload: function($dialog) {
                            // 证书类型选择事件
                            $dialog.find('[name="cert_provide"]').change(function (e) {
                                var $this = $(this);
                                var radioValue = $this.val();
                                // 显隐证书私钥文件上传框
                                if (radioValue == 'self') {
                                    $('[_dn_cdn_action="certificate_upload"]').removeClass("hide");
                                    $('[_dn_cdn_action="keyfile_upload"]').removeClass("hide");
                                } 
                                else {
                                    $('[_dn_cdn_action="certificate_upload"]').addClass("hide");
                                    $('[_dn_cdn_action="keyfile_upload"]').addClass("hide");
                                }
                            });
                            // 重新上传点击事件
                            $dialog.find('[_dn_cdn_action="certificate_upload_span"]').click(function(e) {
                                $dialog.find('[_dn_cdn_action="cert_file"]').trigger("click");
                                // 点击重新上传之后，显示证书私钥输入框，隐藏重新上传按钮
                                $dialog.find('[_dn_cdn_action="certificate_upload_span"]').addClass("hide");
                                $dialog.find('[_dn_cdn_action="cert_file_span"]').removeClass("hide");
                                $dialog.find('[_dn_cdn_action="keyfile_upload_span"]').addClass("hide");
                                $dialog.find('[_dn_cdn_action="key_file_span"]').removeClass("hide");
                            });
                            $dialog.find('[_dn_cdn_action="keyfile_upload_span"]').click(function(e) {
                                $dialog.find('[_dn_cdn_action="key_file"]').trigger("click");
                                // 点击重新上传之后，显示证书私钥输入框，隐藏重新上传按钮
                                $dialog.find('[_dn_cdn_action="certificate_upload_span"]').addClass("hide");
                                $dialog.find('[_dn_cdn_action="cert_file_span"]').removeClass("hide");
                                $dialog.find('[_dn_cdn_action="keyfile_upload_span"]').addClass("hide");
                                $dialog.find('[_dn_cdn_action="key_file_span"]').removeClass("hide");
                            });
                            // 证书上传事件
                            $dialog.find('[_dn_cdn_action="cert_file"]').change(function (e) {
                                $('[_dn_cdn_action="cert_file_txt"]').val($(this).val());
                                $dialog.find('[_dn_cdn_action="certificate_upload_span"]').addClass("hide");
                                $dialog.find('[_dn_cdn_action="cert_file_span"]').removeClass("hide");
                            });
                            // 私钥上传事件
                            $dialog.find('[_dn_cdn_action="key_file"]').change(function (e) {
                                $('[_dn_cdn_action="key_file_txt"]').val($(this).val());
                                $dialog.find('[_dn_cdn_action="keyfile_upload_span"]').addClass("hide");
                                $dialog.find('[_dn_cdn_action="key_file_span"]').removeClass("hide");
                            });
                            // 初始化面板默认选中的选项
                            if (lineData.ssl_type == 1 || lineData.ssl_type == 3) {
                                $dialog.find('[value="platform"]').attr("checked", "checked");
                            }
                            else if (lineData.ssl_type == 2 || lineData.ssl_type == 4) {
                                $dialog.find('[value="self"]').attr("checked", "checked");
                                $('[_dn_cdn_action="certificate_upload"]').removeClass("hide");
                                $('[_dn_cdn_action="keyfile_upload"]').removeClass("hide");
                            }
                            else if (lineData.ssl_type == 5 || lineData.ssl_type == 6) {
                                $dialog.find('[value="third"]').attr("checked", "checked");
                            }

                            if (lineData.ssl_type == 1 || lineData.ssl_type == 2 || lineData.ssl_type == 5) {
                                $dialog.find('[value="http"]').attr("checked", "checked");
                            }
                            else if (lineData.ssl_type == 3 || lineData.ssl_type == 4 || lineData.ssl_type == 6) {
                                $dialog.find('[value="https"]').attr("checked", "checked");
                            }
                            // 泛域名只能接自有证书
                            if (lineData.host.indexOf("*") > -1)
                            {
                                $dialog.find('[value="third"]').prop("disabled", true);
                                $dialog.find('[value="self"]').prop("checked", true);
                                $dialog.find('[_dn_cdn_action="certficate_tip"]').removeClass("hide");
                                $dialog.find('[name="cert_provide"]').trigger("change");
                            }
                            else {
                                $dialog.find('[value="third"]').prop("disabled", false);
                                $dialog.find('[_dn_cdn_action="certficate_tip"]').addClass("hide");
                            }
                            // cos只能接http回源
                            if (lineData.host_type == "cos") {
                                $dialog.find('[value="https"]').prop("disabled", true);
                                $dialog.find('[value="http"]').prop("checked", true);
                                $dialog.find('[_dn_cdn_action="fwd_tip"]').removeClass("hide");
                            }
                            else {
                                $dialog.find('[value="https"]').prop("disabled", false);
                                $dialog.find('[_dn_cdn_action="fwd_tip"]').addClass("hide");
                            }
                        },
                        button: {
                            '确定': function($btn, $dialog) {
                                var certType = $dialog.find('[name="cert_provide"]:checked').val();
                                var fetchType = $dialog.find('[name="fetch_type"]:checked').val();

                                /*
                                1 腾讯提供 + http 回源
                                2 自提供 + http 回源
                                3 腾讯提供 + https 回源
                                4 自提供 + https 回源
                                5 第三方证书 + http回源
                                6 第三方证书 + https回源
                                **/
                                var sslType = 0;
                                if (certType == 'platform') {
                                    if (fetchType == 'http')
                                    {
                                        sslType = 1;
                                    } 
                                    else if (fetchType == 'https') {
                                        sslType = 3;
                                    }
                                } else if (certType == 'self') {
                                    if (fetchType == 'http')
                                    {
                                        sslType = 2;
                                    } 
                                    else if (fetchType == 'https') {
                                        sslType = 4;
                                    }
                                } else if (certType == 'third') {
                                    if (fetchType == 'http')
                                    {
                                        sslType = 5;
                                    } 
                                    else if (fetchType == 'https') {
                                        sslType = 6;
                                    }
                                }
                                // 如果ssl_pid != 0 则说明域名是腾讯证书生成的域名，进行操作时要传ssl_pid
                                $dialog.find('[_dn_cdn_data="host_id_input"]').val(lineData.ssl_pid || lineData.host_id);
                                // ssl_pid != 0 则不传host
                                if (!lineData.ssl_pid)
                                {
                                    $dialog.find('[_dn_cdn_data="host_input"]').val(lineData.host);
                                }
                                else {
                                    $dialog.find('[_dn_cdn_data="host_input"]').remove();
                                }
                                $dialog.find('[_dn_cdn_data="https_type_input"]').val(sslType);

                                // https 证书提交表单的时候需要用到全局函数接收回复
                                window.cdn_https_submit_callback = function (rs) {
                                    nmc.requestStop();
                                    var errCodeMsg = {
                                        "22035": "SSL类型错误",
                                        "22036": "SSL域名错误",
                                        "22037": "SSL开通错误",
                                        "22038": "SSL关闭错误",
                                        "22039": "当前用户暂无法开通中间源服务",
                                        "22040": "此域名已开通HTTPS服务",
                                        "22041": "此域名未启动CDN",
                                        "22042": "此域名开启腾讯证书ssl超过数量限制",
                                        "22054": "泛域名不能用腾讯证书",
                                        "9335": "开通HTTP服务出现错误,提交的文件不合法",
                                        "9336": "开通HTTP服务出现错误,提交的文件处理失败",
                                        "9348": "请求数据为空或者不合法",
                                        "9349": "请求数据不完整",
                                        "9351": "域名ID不合法",
                                        "9353": "域名ID不存在",
                                        "9363": "证书格式不正确",
                                        "9365": "私钥格式不正确",
                                        "9367": "证书私钥校验不正确",
                                        "9368": "证书校验不正确",
                                        "9369": "证书校验不正确",
                                        "9370": "证书私钥链校验不正确",
                                        "9372": "证书不能覆盖此域名"
                                    };

                                    if (rs.code != 0) {
                                        tips.error(errCodeMsg[rs.code] || rs.msg);
                                    } else {
                                        refresh();
                                    }
                                };

                                /* form post start */
                                var form = $dialog.find('[_dn_cdn_action="https_form"]');
                                form.attr('action', 'https:' + CDN.FormSender.serverUrl + '/ajax/api.php?action=set_host_https&g_tk=' + util.getACSRFToken());
                                var iframeID = 'iframe_' + new Date().getTime();

                                // 校验文件格式与大小
                                var $certFile = $dialog.find("[_dn_cdn_action='cert_file']");
                                var $httpsKeyFile = $dialog.find("[_dn_cdn_action='key_file']");
                                var $certFileInput = $dialog.find("[_dn_cdn_action='certificate_upload_div']");
                                var $httpsKeyFileInput = $dialog.find("[_dn_cdn_action='keyfile_upload_div']");
                                var fileTypeReg = /^.*\.pem$/;
                                var keyTypeReg = /^.*\.(cert|cer)$/;
                                var fileSizeLimit = 500 * 1024;
                                // 判断是否重新上传
                                var isReUpload = !$dialog.find("[_dn_cdn_action='cert_file_span']").hasClass("hide");
                                if (certType == 'self' && isReUpload)
                                {
                                    var certFile = $certFile.prop('files')[0];
                                    var keyFile = $httpsKeyFile.prop('files')[0];
                                    if (!certFile || !fileTypeReg.test(certFile.name) || certFile.size > fileSizeLimit)
                                    {
                                        $certFileInput.addClass("error");
                                        return;
                                    }
                                    if (!keyFile ||　keyTypeReg.test(keyFile.name) || keyFile.size > fileSizeLimit) {
                                        $httpsKeyFileInput.addClass("error");
                                        return;
                                    }
                                }
                                // 校验成功去除错误提示
                                $certFileInput.removeClass("error");
                                $httpsKeyFileInput.removeClass("error");

                                ajaxPostForm.post.call(form[0], {
                                    iframeID: iframeID,
                                    post: function() {
                                    },
                                    complete: function(d) {},
                                    // 上传私钥格式不正确回调提示
                                    error: function(e) {
                                        tips.error("私钥格式不正确");
                                    }
                                });

                                form.trigger('submit');
                                // 显示转菊花
                                nmc.requestStart();
                                /* form post end */
                                dialog.hide();
                            }
                        }
                    });
                },
                // 删除按钮点击事件
                "click tr a[_dn_cdn_action='disable']": function(e) {
                    var index = $(e.target).parents("tr").data("index");
                    var lineData = this.$data.list[index];
                    stopHttps(lineData.ssl_pid || lineData.host_id, false, lineData.ssl_type, lineData.host);
                },
                // 表格头checkbox点击事件
                "click thead tr input": function(e) {
                    var checkAll = $("table thead input:checked").prop("checked");
                    if (checkAll && certificateTableData.length > 0) {
                        $("[_dn_cdn_action='disable_checked']").removeClass("disabled");
                    }
                    else {
                        $("[_dn_cdn_action='disable_checked']").addClass("disabled");
                    }
                },
                // 表格内checkbox点击事件
                "click tbody tr input": function(e) {
                    var checkedLength = $("table tbody input:checked").length;
                    if (checkedLength > 0) {
                        $("[_dn_cdn_action='disable_checked']").removeClass("disabled");
                    }
                    else {
                        $("[_dn_cdn_action='disable_checked']").addClass("disabled");
                    }
                },
                // 表格内点击选择邮箱
                "click tbody tr [_dn_cdn_action='choose_mailbox']": function(e) {
                    var index = $(e.target).parents("tr").data("index");
                    var lineData = this.$data.list[index];
                    var domain = lineData.host;
                    // 获取邮箱
                    dao.get_https_mail({
                        data: {
                            domain: domain
                        },
                        success: {
                            "0": function(rs) {
                                createChooseMailDialog(domain, rs.data.email, lineData.host_id);
                            },
                            "default": function(rs) {
                                if (rs.msg) {
                                    tips.error(rs.msg);
                                } else {
                                    tips.error(_defaultErrMsg);
                                }
                            }
                        }
                    });
                },
                // 表格内点击重新发送邮件
                "click tbody tr [_dn_cdn_action='resend_email']": function(e) {
                    if ($(e.target).hasClass("text-primary")) {
                        return;
                    }
                    var index = $(e.target).parents("tr").data("index");
                    var lineData = this.$data.list[index];
                    var timeCount = $(e.target).parents("tr").find('[_dn_cdn_action="resend_email_done"]');
                    reSendEmail(lineData.host, $(e.target), timeCount);
                }
            },
            $data : {
                canSelectTotal : false,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示
                // 表头/列配置
                colums : tableColums,
                maxHeightOffset : 10,// 最大高度的偏移值
                hasFirst: true,// 表格首列设成checkbox
            },
            getCellContent: function(val, item, col) {
                var res = val;
                if (col.key == 'host')
                {
                    res = "<span class='text-overflow'>" + val + "</span>";
                }
                else if(col.key == 'status') {
                    res = tmpl.parse($('[_dn_cdn_tmpl="cert_status"]').html(), {data: item});
                }
                // else if(col.key == 'https') {
                //     res = '<div class=""><span class="text-overflow text-warning">否</span></div>';
                // }
                else if (col.key =='source') {
                    res = tmpl.parse($('[_dn_cdn_tmpl="cert_source"]').html(), {data: item});
                }
                else if (col.key =='deploy_time') {
                    if (item.ssl_status == 3 && item.ssl_deploy_time)
                    {
                        res = item.ssl_deploy_time.substring(0, 10);
                    }
                    else {
                        res = "--";
                    }
                }
                else if (col.key =='expired_time') {
                    if (item.ssl_status == 3 && item.ssl_expire_time)
                    {
                        res = item.ssl_expire_time.substring(0, 10);
                    } else {
                        res = "--";
                    }
                }
                else if (col.key == 'type') {
                    res = tmpl.parse($('[_dn_cdn_tmpl="cert_fwd_type"]').html(), {data: item});
                }
                else if (col.key=='operation') {
                    res = tmpl.parse($('[_dn_cdn_tmpl="cert_operation"]').html(), {data: item});
                }
                return res;
            },
            getData: function(opts) {
                var res = certificateTableData;
                var order = opts.order;
                var orderField = opts.orderField;
                if(!res){
                    return;
                }
                if (orderField) {
                    if (order == 1) {
                        res.sort(function(item1, item2) {
                            return parseFloat(item1[orderField]) - parseFloat(item2[orderField]);
                        });
                    }
                    else {
                        res.sort(function(item1, item2) {
                            return parseFloat(item2[orderField]) - parseFloat(item1[orderField]);
                        });
                    }
                }
                var page = opts.page;
                var count = opts.count;
                if(!opts.type){
                    this.setData({
                        totalNum : res.length,
                        page : page,
                        count : count,
                        list : res.slice((page - 1) * count, page * count)
                    });
                }  
            }
        }); 
    };

    var initEvent = function() {
        // 部署证书按钮
        initDeployBtnEvent();
        // 删除按钮
        initStopBtnEvent();
        // 搜索按钮
        initSearchBtnEvent();
    };

    // 部署证书按钮
    var initDeployBtnEvent = function() {
        $('[_dn_cdn_action="deploy"]').on("click", function(e) {
            var target = $(this);
            if (target.hasClass("disabled")) {
                return;
            }
            dialog.create(tmpl.parse($('[_dn_cdn_tmpl="deploy_certificate"]').html(), {data: hostList}), 580, '', {
                title: '部署证书',
                struct: "rich",
                onload: function($dialog) {
                    // 设置单选框的状态
                    var setRadioStatus = function(host, host_type) {
                        //  泛域名只能用自有证书
                        if (host.indexOf("*") > -1)
                        {
                            $dialog.find('[value="third"]').prop("disabled", true);
                            $dialog.find('[value="self"]').prop("checked", true);
                            $dialog.find('[_dn_cdn_action="certficate_tip"]').removeClass("hide");
                            $dialog.find('[name="cert_provide"]').trigger("change");
                        }
                        else {
                            $dialog.find('[value="third"]').prop("disabled", false);
                            $dialog.find('[_dn_cdn_action="certficate_tip"]').addClass("hide");
                        }
                        // cos 域名只能是http回源
                        if (host_type == "cos") {
                            $dialog.find('[value="https"]').prop("disabled", true);
                            $dialog.find('[value="http"]').prop("checked", true);
                            $dialog.find('[_dn_cdn_action="fwd_tip"]').removeClass("hide");
                        }
                        else {
                            $dialog.find('[value="https"]').prop("disabled", false);
                            $dialog.find('[_dn_cdn_action="fwd_tip"]').addClass("hide");
                        }
                    };
                    // 下拉面板展开事件
                    // 监听整个面板的点击事件，点在输入框之外或者点在下拉框则都返回并隐藏下拉框
                    $dialog.find('[_dn_cdn_data="select_panel"]').on("click", function(e) {
                        // 下拉框之外面板之内则return，否则显示下拉框
                        if ($(e.target).parents('[_dn_cdn_data="select_host_list"]').length > 0 || $(e.target).parents('[_dn_cdn_data="select_host_div"]').length == 0)
                        {
                            $dialog.find('[_dn_cdn_data="select_host_list"]').css("display", "none");
                            return;
                        }
                        $dialog.find('[_dn_cdn_data="select_host_list"]').toggle();
                    });
                    // 域名选择事件
                    $dialog.find('[_dn_cdn_data="select_host_list"]').on("click", function(e) {
                        var target = $(e.target);
                        var host_id = target.data("val");
                        var host;
                        var host_type;
                        if (host_id) {
                            $dialog.find('[_dn_cdn_data="select_host_input"]').val(target.text());
                            $dialog.find('[_dn_cdn_data="select_host_input"]').data("host-id", host_id);
                            $dialog.find('[_dn_cdn_data="select_host_list"]').css("display", "none");
                            $dialog.find('[_dn_cdn_data="select_host_list"] .selected').removeClass("selected");
                            target.addClass("selected");
                            host = target.text();
                            host_type = target.data("host_type");
                            //  泛域名只能用自有证书
                            setRadioStatus(host, host_type);

                            // 使能确定按钮
                            if ($dialog.find('[_dn_cdn_action="https_contract"]').prop("checked"))
                            {
                                dialog.toggleBtnDisable(0, 0);
                            }
                        }
                        return false;
                    });
                    // 域名搜索事件
                    $dialog.find('[_dn_cdn_data="select_host_input"]').on("keyup", function(e) {
                        var searchStr = $(this).val();
                        var list = $dialog.find('[_dn_cdn_data="select_host_list"]').find('li[_dn_cdn_data="host"]');
                        var length = list.length;
                        list.each(function(index, item) {
                            var target = $(item);
                            if (target.text().indexOf(searchStr) > -1) {
                                target.removeClass("hide");
                            }
                            else {
                                target.addClass("hide");
                            }
                        });
                        var list_hide = $dialog.find('[_dn_cdn_data="select_host_list"]').find('li[_dn_cdn_data="host"].hide');
                        var length_hide = list_hide.length;
                        if (length_hide == length) {
                            $dialog.find('[_dn_cdn_data="no_result"]').removeClass("hide");
                        }
                        else {
                            $dialog.find('[_dn_cdn_data="no_result"]').addClass("hide");
                        }
                    });
                    // 证书类型选择事件
                    $dialog.find('[name="cert_provide"]').change(function (e) {
                        var $this = $(this);
                        var radioValue = $this.val();
                        if (radioValue == 'self') {
                            $('[_dn_cdn_action="certificate_upload"]').removeClass("hide");
                            $('[_dn_cdn_action="keyfile_upload"]').removeClass("hide");
                        } 
                        else {
                            $('[_dn_cdn_action="certificate_upload"]').addClass("hide");
                            $('[_dn_cdn_action="keyfile_upload"]').addClass("hide");
                        }
                    });
                    // 证书上传事件
                    $dialog.find('[_dn_cdn_action="cert_file"]').change(function (e) {
                        $('[_dn_cdn_action="cert_file_txt"]').val($(this).val());
                    })
                    // 私钥上传事件
                    $dialog.find('[_dn_cdn_action="key_file"]').change(function (e) {
                        $('[_dn_cdn_action="key_file_txt"]').val($(this).val());
                    })
                    // 服务条款选择事件
                    $dialog.find('[_dn_cdn_action="https_contract"]').change(function(e) {
                        var target = $(this);
                        var host_id = $dialog.find('[_dn_cdn_data="select_host_input"]').data("host-id");
                        var checked = !!$dialog.find('[_dn_cdn_action="https_contract"]').prop("checked");
                        if (host_id)
                        {
                            dialog.toggleBtnDisable(!checked, 0);
                        }
                    });

                    // 根据第一个域名(cos或泛域名)，初始化单选框
                    var first_host = $dialog.find('[_dn_cdn_data="select_host_input"]').val();     
                    var first_host_type = $dialog.find('[_dn_cdn_data="select_host_input"]').data("host_type");
                    setRadioStatus(first_host, first_host_type);

                    if (hostList.hosts.length == 0) {
                        $dialog.find('[_dn_cdn_action="domain_tip"]').removeClass("hide");
                    }
                },
                button: {
                    '确定': function($btn, $dialog) {
                        var certType = $dialog.find('[name="cert_provide"]:checked').val();
                        var fetchType = $dialog.find('[name="fetch_type"]:checked').val();

                        /*
                        1 腾讯提供 + http 回源
                        2 自提供 + http 回源
                        3 腾讯提供 + https 回源
                        4 自提供 + https 回源
                        5 第三方证书 + http回源
                        6 第三方证书 + https回源
                        **/
                        var sslType = 0;
                        var host = $dialog.find('[_dn_cdn_data="select_host_input"]').val();
                        var host_id = $dialog.find('[_dn_cdn_data="select_host_input"]').data("host-id");

                        if (certType == 'platform') {
                            if (fetchType == 'http')
                            {
                                sslType = 1;
                            } 
                            else if (fetchType == 'https') {
                                sslType = 3;
                            }
                        } else if (certType == 'self') {
                            if (fetchType == 'http')
                            {
                                sslType = 2;
                            } 
                            else if (fetchType == 'https') {
                                sslType = 4;
                            }
                        } else if (certType == 'third') {
                            if (fetchType == 'http')
                            {
                                sslType = 5;
                            } 
                            else if (fetchType == 'https') {
                                sslType = 6;
                            }
                        }
                        $dialog.find('[_dn_cdn_data="host_id_input"]').val(host_id);
                        $dialog.find('[_dn_cdn_data="host_input"]').val(host);
                        $dialog.find('[_dn_cdn_data="https_type_input"]').val(sslType);

                        // https 证书提交表单的时候需要用到全局函数接收回复
                        window.cdn_https_submit_callback = function (rs) {
                            nmc.requestStop();
                            var errCodeMsg = {
                                "22035": "SSL类型错误",
                                "22036": "SSL域名错误",
                                "22037": "SSL开通错误",
                                "22038": "SSL关闭错误",
                                "22039": "当前用户暂无法开通中间源服务",
                                "22040": "此域名已开通HTTPS服务",
                                "22041": "此域名未启动CDN",
                                "22042": "此域名开启腾讯证书ssl超过数量限制",
                                "22054": "泛域名不能用腾讯证书",
                                "9335": "开通HTTP服务出现错误,提交的文件不合法",
                                "9336": "开通HTTP服务出现错误,提交的文件处理失败",
                                "9348": "请求数据为空或者不合法",
                                "9349": "请求数据不完整",
                                "9351": "域名ID不合法",
                                "9353": "域名ID不存在",
                                "9363": "证书格式不正确",
                                "9365": "私钥格式不正确",
                                "9367": "证书私钥校验不正确",
                                "9368": "证书校验不正确",
                                "9369": "证书校验不正确",
                                "9370": "证书私钥链校验不正确",
                                "9372": "证书不能覆盖此域名"
                            }

                            if (rs.code != 0) {
                                tips.error(errCodeMsg[rs.code] || rs.msg);
                            } else {
                                refresh();
                            }
                        };

                        /* form post start */
                        var form = $dialog.find('[_dn_cdn_action="https_form"]');
                        form.attr('action', 'https:' + CDN.FormSender.serverUrl + '/ajax/api.php?action=set_host_https&g_tk=' + util.getACSRFToken());
                        var iframeID = 'iframe_' + new Date().getTime();

                        // 校验文件格式与大小
                        var $certFile = $dialog.find("[_dn_cdn_action='cert_file']");
                        var $httpsKeyFile = $dialog.find("[_dn_cdn_action='key_file']");
                        var $certFileInput = $dialog.find("[_dn_cdn_action='certificate_upload_div']");
                        var $httpsKeyFileInput = $dialog.find("[_dn_cdn_action='keyfile_upload_div']");
                        var fileTypeReg = /^.*\.pem$/;
                        var keyTypeReg = /^.*\.(cert|cer)$/;
                        var fileSizeLimit = 500 * 1024;
                        if (certType == 'self')
                        {
                            var certFile = $certFile.prop('files')[0];
                            var keyFile = $httpsKeyFile.prop('files')[0];
                            if (!fileTypeReg.test(certFile.name) || certFile.size > fileSizeLimit)
                            {
                                $certFileInput.addClass("error");
                                return;
                            }
                            if (keyTypeReg.test(keyFile.name) || keyFile.size > fileSizeLimit) {
                                $httpsKeyFileInput.addClass("error");
                                return;
                            }
                        }
                        // 校验成功去除错误提示
                        $certFileInput.removeClass("error");
                        $httpsKeyFileInput.removeClass("error");

                        ajaxPostForm.post.call(form[0], {
                            iframeID: iframeID,
                            post: function() {
                            },
                            complete: function(d) {},
                            // 上传私钥格式不正确回调提示
                            error: function(e) {
                                tips.error("私钥格式不正确");
                            }
                        });

                        form.trigger('submit');
                        // 显示转菊花
                        nmc.requestStart();
                        dialog.hide();
                    }
                },
                buttonDisable: [1]
            });
        });
    };

    // 批量删除按钮事件
    var initStopBtnEvent = function() {
        $('[_dn_cdn_action="disable_checked"]').on("click", function(e) {
            var target = $(this);
            if (target.hasClass("disabled")) {
                return;
            }
            var selectedData = certificateTable.getSelected();
            var host_ids = [];
            selectedData.forEach(function(item, index) {
                host_ids.push(item.ssl_pid || item.host_id);
            });
            stopHttps(host_ids.join(","), true);
        });
    };

    // 点击搜索按钮
    var initSearchBtnEvent = function() {
        var search = function() {
            var filter_txt = $.trim($('[_dn_cdn_data="filter_txt"]').val());
            certificateTableData = [];
            certList.hosts.forEach(function(item, index, arr) {
                var rowData = {};
                if (item.host.indexOf(filter_txt) > -1)
                {
                    certificateTableData.push(item);
                }
            });
            certificateTable.setData({
                totalNum : certificateTableData.length,
                page : 1,
                count : 10,
                list : certificateTableData.slice(0, 10),
                type:"reload"
            });

            // 临时规避：表格最后一行的tip，改为向上浮现，避免被表格下边界挡住
            var tableRows = $('[data-role="grid-view"] table tr');
            if (tableRows.length > 2) {
                tableRows.eq(tableRows.length-1).find(".tc-15-bubble-top").removeClass("tc-15-bubble-top").addClass("tc-15-bubble-bottom");
            }
        };
        $('[_dn_cdn_action="filter"]').on("click", function(e) {
            search();
        });

        $('[_dn_cdn_data="filter_txt"]').on("keyup", function(e) {
            if (e.keyCode == 13){
                search();
            }
        });
    };

    // 上方tip选择邮箱
    var initChooseMailClickEvent = function() {
        $('[_dn_cdn_action="fail_certificate_tip"] [_dn_cdn_action="choose_mailbox"]').on("click", function(e) {
            var target = $(this);
            var domain = target.data("domain");
            var host_id = target.data("host-id");
            // 获取邮箱
            dao.get_https_mail({
                data: {
                    domain: domain
                },
                success: {
                    "0": function(rs) {
                        createChooseMailDialog(domain, rs.data.email, host_id);
                    },
                    "default": function(rs) {
                        if (rs.msg) {
                            tips.error(rs.msg);
                        } else {
                            tips.error(_defaultErrMsg);
                        }
                    }
                }
            });  
        });
    };
    // 上方tip的重发邮件事件
    var initResendEmailEvent = function() {
        $('[_dn_cdn_action="fail_certificate_tip"] [_dn_cdn_action="resend_email"]').on("click", function(e) {
            var host = $(e.target).data("host");
            var resendBtn = $(e.target);
            var timeCount = $(e.target).parent().find('[_dn_cdn_action="resend_email_done"]');
            reSendEmail(host, resendBtn, timeCount);
        });
    };

    // 验证失败的tip关闭事件
    var initTipCloseEvent = function() {
        $('[_dn_cdn_action="tip_close"]').on("click", function(e) {
            var target = $(this);
            $(this).parents("p.error").remove();
        });
    };

    // 创建选择邮箱对话框
    var createChooseMailDialog = function(domain, email, host_id) {
        dialog.create(tmpl.parse($('[_dn_cdn_tmpl="dialog_send_email"]').html(), {domain: domain, email: email, host_id: host_id}), 580, '', {
            title: '选择验证邮箱',
            struct: "rich",
            button: {
                '发送': function($btn, $dialog) {
                    // https 证书提交表单的时候需要用到全局函数接收回复
                    window.cdn_https_submit_callback = function (rs) {
                        nmc.requestStop();
                        var errCodeMsg = {
                            "22035": "SSL类型错误",
                            "22036": "SSL域名错误",
                            "22037": "SSL开通错误",
                            "22038": "SSL关闭错误",
                            "22039": "当前用户暂无法开通中间源服务",
                            "22040": "此域名已开通HTTPS服务",
                            "22041": "此域名未启动CDN",
                            "22042": "此域名开启腾讯证书ssl超过数量限制",
                            "22054": "泛域名不能用腾讯证书",
                            "9335": "开通HTTP服务出现错误,提交的文件不合法",
                            "9336": "开通HTTP服务出现错误,提交的文件处理失败",
                            "9348": "请求数据为空或者不合法",
                            "9349": "请求数据不完整",
                            "9351": "域名ID不合法",
                            "9353": "域名ID不存在",
                            "9363": "证书格式不正确",
                            "9365": "私钥格式不正确",
                            "9367": "证书私钥校验不正确",
                            "9368": "证书校验不正确",
                            "9369": "证书校验不正确",
                            "9370": "证书私钥链校验不正确",
                            "9372": "证书不能覆盖此域名"
                        }

                        if (rs.code != 0) {
                            tips.error(errCodeMsg[rs.code] || rs.msg);
                        } else {
                            refresh();
                        }
                    };
                    // 设置选中邮箱
                    var select_mailbox = $dialog.find('[_dn_cdn_data="select_mailbox"]').val();
                    $dialog.find('[_dn_cdn_action="approver_email"]').val(select_mailbox);

                    /* form post start */
                    var form = $dialog.find('[_dn_cdn_action="https_form"]');
                    form.attr('action', 'https:' + CDN.FormSender.serverUrl + '/ajax/api.php?action=set_host_https&g_tk=' + util.getACSRFToken());
                    var iframeID = 'iframe_' + new Date().getTime();
                    ajaxPostForm.post.call(form[0], {
                        iframeID: iframeID,
                        post: function() {
                        },
                        complete: function(d) {},
                        // 上传私钥格式不正确回调提示
                        error: function(e) {
                            tips.error("私钥格式不正确");
                        }
                    });

                    form.trigger('submit');
                    // 显示转菊花
                    nmc.requestStart();
                    /* form post end */
                    dialog.hide();
                }
            }
        });
    };

    // 重新发送邮件
    var reSendEmail = function(host, resendBtn, timeCount) {
        dao.resend_email({
            data: {
                host: host
            },
            success: {
                "0": function(rs) {
                    resendBtn.addClass("text-primary");
                    resendBtn.addClass("hide");
                    timeCount.removeClass("hide");
                    timeCount.removeClass("text-primary");
                    var count = 120;
                    var interval = setInterval(function() {
                        count--;
                        timeCount.find("em").text(count + "秒");
                        if (count == 0) {
                            resendBtn.removeClass("text-primary");
                            resendBtn.removeClass("hide");
                            timeCount.addClass("hide");
                            timeCount.addClass("text-primary");
                            clearInterval(interval);
                        }
                    }, 1000);
                },
                "default": function(rs) {
                    if (rs.msg) {
                        tips.error(rs.msg);
                    } else {
                        tips.error(_defaultErrMsg);
                    }
                }
            }
        });
    };

    // 删除https证书
    var stopHttps = function(host_id, batch, ssl_type, host) {
        dialog.create(tmpl.parse($('[_dn_cdn_tmpl="dialog_stop_https"]').html(), {host_id: host_id, batch: batch, ssl_type: ssl_type || null, host: host || ""}), 480, '', {
            title: '删除HTTPS证书',
            struct: "rich",
            button: {
                '确定': function($btn, $dialog) {
                    // https 证书提交表单的时候需要用到全局函数接收回复
                    window.cdn_https_submit_callback = function (rs) {
                        nmc.requestStop();
                        var errCodeMsg = {
                            "22035": "SSL类型错误",
                            "22036": "SSL域名错误",
                            "22037": "SSL开通错误",
                            "22038": "SSL关闭错误",
                            "22039": "当前用户暂无法开通中间源服务",
                            "22040": "此域名已开通HTTPS服务",
                            "22041": "此域名未启动CDN",
                            "22042": "此域名开启腾讯证书ssl超过数量限制",
                            "22054": "泛域名不能用腾讯证书",
                            "9335": "开通HTTP服务出现错误,提交的文件不合法",
                            "9336": "开通HTTP服务出现错误,提交的文件处理失败",
                            "9348": "请求数据为空或者不合法",
                            "9349": "请求数据不完整",
                            "9351": "域名ID不合法",
                            "9353": "域名ID不存在",
                            "9363": "证书格式不正确",
                            "9365": "私钥格式不正确",
                            "9367": "证书私钥校验不正确",
                            "9368": "证书校验不正确",
                            "9369": "证书校验不正确",
                            "9370": "证书私钥链校验不正确",
                            "9372": "证书不能覆盖此域名"
                        }

                        if (rs.code != 0) {
                            tips.error(errCodeMsg[rs.code] || rs.msg);
                        } else {
                            refresh();
                        }
                    };

                    /* form post start */
                    var form = $dialog.find('[_dn_cdn_action="https_form"]');
                    form.attr('action', 'https:' + CDN.FormSender.serverUrl + '/ajax/api.php?action=set_host_https&g_tk=' + util.getACSRFToken());
                    var iframeID = 'iframe_' + new Date().getTime();
                    ajaxPostForm.post.call(form[0], {
                        iframeID: iframeID,
                        post: function() {
                        },
                        complete: function(d) {},
                        // 上传私钥格式不正确回调提示
                        error: function(e) {
                            tips.error("私钥格式不正确");
                        }
                    });

                    form.trigger('submit');
                    // 显示转菊花
                    nmc.requestStart();
                    /* form post end */
                    dialog.hide();
                }
            }
        });
    };

    var refresh = function() {
        // 获取https证书列表
        dao.get_cert_list({
            success: {
                "0": function(rs) {
                    certList = rs.data;
                    if (certList.hosts && certList.hosts.length > 0)
                    {
                        certificateTableData = [];
                        certList.hosts.forEach(function(item, index, arr) {
                            var rowData = {};
                            certificateTableData.push(item);
                        });

                        certificateTable.setData({
                            totalNum : certificateTableData.length,
                            page : 1,
                            count : 10,
                            list : certificateTableData.slice(0, 10),
                            type:"reload"
                        });

                        // 临时规避：表格最后一行的tip，改为向上浮现，避免被表格下边界挡住
                        var tableRows = $('[data-role="grid-view"] table tr');
                        if (tableRows.length > 2) {
                            tableRows.eq(tableRows.length-1).find(".tc-15-bubble-top").removeClass("tc-15-bubble-top").addClass("tc-15-bubble-bottom");
                        }

                        $('[_dn_cdn_action="fail_certificate_tip"]').html(tmpl.parse($('[_dn_cdn_tmpl="fail_certificate"]').html(), {data: certList.hosts}));

                        // 选择邮箱
                        initChooseMailClickEvent();

                        // 验证失败的tip关闭事件
                        initTipCloseEvent();
                        // 重新发送邮件事件
                        initResendEmailEvent();
                        // 灰化删除按钮
                        $("[_dn_cdn_action='disable_checked']").addClass("disabled");
                    }
                },
                "default": function(rs) {
                    if (rs.msg) {
                        tips.error(rs.msg);
                    } else {
                        tips.error(_defaultErrMsg);
                    }
                }
            }
        });

        dao.getAllHostList({
            mode: 'https'
        }, function(rs) {
            if (rs.data && rs.data.hosts)
            {
                hostList = rs.data;
                $('[_dn_cdn_action="deploy"]').removeClass("disabled");
            }     
        });
    };

    return {
        container: certificateTemplate,
        init: function(){
            initTable();

            initEvent();

            refresh();
        }
    };
});/*  |xGv00|ae00932196f9cd5ad8c7bbcce5b599fb */