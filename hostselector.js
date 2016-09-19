/**
 * @author galenye
 * @created 2016/7/22
 * @description 注册一个Bee组件，域名下拉选择框
 * @params [Object]
 * {
 *     list: 域名列表
 * }
 * @return
 * output [String] 最终吐出的选择的域名，如果全选域名且无搜索key，则吐出空字符串 
 * 
 */
define(function(require, exports, module) {
    var Bee = require('qccomponent');
    var _ = require('cdn/lib/underscore');
    var widgets = require('cdn/widgets/widgets')
    var htmlTemplate = require("../templates/hostselector.html.js");


    var hostSelector = Bee.extend({
        $tpl: htmlTemplate,

        $data: {
            hostList: [],
            showList: [],
            searchKey: '',
            currHost: [],
            checkAll: true,
            inputVal: '全部域名',
            output: ''
        },

        $events: {
            "click [data-select-panel]": function(e) {
                var self = $(e.target);

                if(self.get(0).hasAttribute('data-item')) {
                    e.stopPropagation();

                }else if(self.get(0).hasAttribute('data-item-label')) {
                    e.stopPropagation();

                }else if(self.get(0).hasAttribute('data-all')) {
                    e.stopPropagation();

                }else if(self.get(0).hasAttribute('data-all-label')) {
                    e.stopPropagation();

                }else if(self.get(0).hasAttribute('data-input-hostname')) {

                }else{
                    return false
                }
            },

            "click [data-item]": function(e) {
                var input = $(e.target);
                var isChecked = input.is(':checked');
                var name = input.data('name');

                if(isChecked) {
                    var currHost = this.currHost;
                    currHost.push(name);

                    this.$set('currHost', currHost)

                    if(this.currHost.length === this.showList.length) {
                        this.$set('checkAll', true)
                    }
                }else {

                    var currHost = this.currHost;
                    var idx = currHost.indexOf(name);

                    currHost.splice(idx, 1);

                    this.$set('currHost', currHost)

                    this.$set('checkAll', false)
                }
            },

            "click [data-item-label]": function(e) {
                var input = $(e.target).prev('[data-item]');
                var isChecked = input.is(':checked');
                input.prop('checked', !isChecked);
                isChecked = input.is(':checked');

                var name = input.data('name');

                if(isChecked) {
                    var currHost = this.currHost;
                    currHost.push(name);

                    this.$set('currHost', currHost)

                    if(this.currHost.length === this.showList.length) {
                        this.$set('checkAll', true)
                    }
                }else {

                    var currHost = this.currHost;
                    var idx = currHost.indexOf(name);

                    currHost.splice(idx, 1);

                    this.$set('currHost', currHost)

                    this.$set('checkAll', false)
                }
            },

            "click [data-all-label]": function(e) {
                $('[data-all]').click()
            },

            "click [data-input-hostname]": function(e) {

                var self = $(e.target);

                var panel = self.siblings('[data-select-panel]');

                panel.toggle();

                panel.css({
                    left:self.position().left
                })

                return false
            },

            "click [data-ok]": function(e) {
                $('[data-select-panel]').hide()
            },

            "click [data-cancel]": function(e) {
                $('[data-select-panel]').hide()
            }
        },
        $afterInit: function() {
            var self = this;

            this.$watch('list', function() {
                var list = [];

                _.each(this.list, function(item, key) {
                    list.push({
                        name: item.name,
                        p_id: item.p_id
                    })
                })

                this.$set('hostList', list)
                this.$set('searchKey', '')
            })

            this.$watch('searchKey', function(searchReg) {
                
                var showList = [];

                if(searchReg) {
                    _.each(this.hostList, function(item, idx) {
                        if(idx<=1000 && item.name.indexOf(searchReg) > -1) {
                            showList.push(item)
                        }
                    })

                    this.$set('showList', showList)
                    this.$set('currHost', [])
                    this.$set('checkAll', false)
                }else {
                    _.each(this.hostList, function(item, idx) {
                        if(idx<=1000) {
                            showList.push(item)
                        }
                    })

                    this.$set('showList', showList)
                    this.$set('checkAll', true)
                }

            })

            this.$watch('checkAll', function(isChecked) {
                if(isChecked) {

                    var inputs = $('.js-hosts-dd-maintain').find('input');

                    _.each(inputs, function(input, idx) {
                        $(input).prop('checked', true)
                    })

                    var currHost = [];
                    _.each(this.showList, function(item) {
                        currHost.push(item.name)
                    })

                    this.$set('currHost', currHost)

                }else {
                    var inputs = $('.js-hosts-dd-maintain').find('input');

                    if(!this.isAllChecked()) {
                        return false;
                    }

                    _.each(inputs, function(input, idx) {
                        $(input).prop('checked', false)
                    })

                    this.$set('currHost', [])
                }

            })

            this.$watch('currHost', function(currHost) {

                if(this.searchKey === '' && currHost.length === this.showList.length) {
                    this.$set('inputVal', '全部域名')
                    this.$set('output', '')
                }else {
                    this.$set('inputVal', currHost.join(','))
                    this.$set('output', currHost.join(','))
                }

            })

            $(window).click(function(e) {
                $('[data-select-panel]').hide()
            })
            
        },

        isAllChecked: function() {
            var inputs = $('.js-hosts-dd-maintain').find('input');
            var _isAllChecked = false;

            _isAllChecked =  _.every(inputs, function(input) {
                return $(input).is(':checked')
            })

            return _isAllChecked
        }
    });

    Bee.tag('host-selector', hostSelector);

    module.exports = hostSelector;
});/*  |xGv00|f1416dc2ef1e7799beee819e9909c884 */