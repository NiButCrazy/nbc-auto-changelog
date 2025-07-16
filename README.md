# nbc-auto-changelog

用于从 git 标签和提交历史生成更改日志的命令行工具  
> 修改自 [auto-changelog](https://github.com/cookpete/auto-changelog)

[![Latest npm version](https://img.shields.io/npm/v/nbc-auto-changelog.svg)](https://www.npmjs.com/package/nbc-auto-changelog)

## 介绍
**最基本的使用方法**

```json
// package.json
{
    "scripts": {
    	"version": "nbc-auto-changelog -p && git add CHANGELOG.md"
  	}
}
```
**接着终端输入**
```shell
npm version
```
>就可以实现 `package.json` 里的 `version` 版本自动更新，然后 `CHANGELOG.md` 会自动生成，并为当新版本 `version` 生成一个新 **标签(tag)** 

具体其他**使用方法**与**配置**和 [auto-changelog](https://github.com/cookpete/auto-changelog) 原版本**相同**,这里不再赘述，值得注意的只有两点：

1. 最好填写 **git 远程仓库名**，不然没法链接到 `commit`、 `issue` 等超链接

2. git 最好设置的是 **GitHub 用户名**，否则 [@NiButCrazy]() 这类超链接无效

   > 设置方法: `git config --gloabl user.name "GitHub 用户名"`

> [!IMPORTANT]
> 主要是讲解一下我个人修改的内容和注意事项:

1. 汉化了`--help` 命令的内容，并且为大部分命令添加了**终端颜色**，更加清晰有条理

2. 将默认模板更换为了 `conventional`，然后又针对 `conventional` 模板又进行了魔改
    > [!WARNING]
	> 这个模板未经过测试，可能会有小 BUG，而且目前里面的 `issue` 、`commit hash`和 `auther` 超链接**只支持 GitHub**
	> 比如 [#11]() 、[e6cc494]() 或 [@NiButCrazy]() 啥的

## 模板规范
> 只针对**默认模板**

> [!TIP]
> 然后就是默认模板的 git 提交消息规范和说明，[点我查看详情](https://www.conventionalcommits.org/zh-hans/v1.0.0/)

##### 先说一般情况，比如一个关键字 `feat`，你可以选择` feat | Feat | feat(scope)`，其中关键字` feat` 只有首字母不区分大小写，`scope` 指的是本次` commit `的作用范围，这个自己觉得合理就行了。然后就是` issue `部分，如果想引用 issue  超链接就必须加个括号`()`，比如 `(#11)` ，以下是一个提交消息的例子

```javascript

Feat(window): 增加了一个无边框窗口切换选项 (#521)

fix: 牢大! (#520)
孩子们我坠机了

close #521  // 这是可选项，遵循 GitHub 自己的规范，链接 议题 或 issue 或 pull 用的

```

### 关键字列表

> 有顺序区别，用作 changelog 的排序依据

- breaking | change - :rotating_light:重大更改(也可以理解为破坏性更改)
- feat - :sparkles:新功能
- fix - :bug:修复
- chore - :package:杂项
- docs - :book:文档
- refactor - :recycle: 重构
- test - :mega: 测试
- style - :books: 样式
- build - :wrench: 依赖 | 构建
- perf - :zap: 优化
- i18n - :globe_with_meridians:: 国际化
- **啥关键词都不填** - :cyclone: 整体修改
