const { Command } = require('commander')
const importCwd = require('import-cwd')
const { version } = require('../package.json')
const { fetchRemote } = require('./remote')
const { fetchTags } = require('./tags')
const { parseReleases } = require('./releases')
const { compileTemplate } = require('./template')
const { parseLimit, readFile, readJson, writeFile, fileExists, updateLog, formatBytes } = require('./utils')

const DEFAULT_OPTIONS = {
  output: 'CHANGELOG.md',
  template: 'conventional',
  remote: 'origin',
  commitLimit: false,
  backfillLimit: false,
  tagPrefix: '',
  sortCommits: 'relevance',
  appendGitLog: '',
  appendGitTag: '',
  config: '.auto-changelog',
  plugins: []
}

const PACKAGE_FILE = 'package.json'
const PACKAGE_OPTIONS_KEY = 'auto-changelog'
const PREPEND_TOKEN = '<!-- auto-changelog-above -->'

const getOptions = async argv => {
  const commandOptions = new Command()
    .option('-o, --output <file>', `输出文件，默认: ${DEFAULT_OPTIONS.output}`)
    .option('-c, --config <file>', `本地配置文件，默认: ${DEFAULT_OPTIONS.config}`)
    .option('-t, --template <template>', `选择指定模板，内置 [conventional, compact, keepachangelog, json]，默认: ${DEFAULT_OPTIONS.template}`)
    .option('-r, --remote <remote>', `指定要用于生成链接的 Git 远程仓库名称，默认: ${DEFAULT_OPTIONS.remote}`)
    .option('-p, --package [file]', '使用文件中的版本作为最新版本，默认: package.json')
    .option('-v, --latest-version <version>', '使用指定版本作为最新版本')
    .option('-u, --unreleased', '包含未发布更改的部分')
    .option('-l, --commit-limit <count>', `每个版本要显示的最大提交数，默认: ${DEFAULT_OPTIONS.commitLimit}`, parseLimit)
    .option('-b, --backfill-limit <count>', `填补空的发布版本所需要的提交数量，默认: ${DEFAULT_OPTIONS.backfillLimit}`, parseLimit)
    .option('--commit-url <url>', '覆盖 commits 的 URL，请使用 {id} 作为 commit 的 ID')
    .option('-i, --issue-url <url>', '覆盖 issues 的 URL，请使用 {id} 作为 issue 的 ID') // -I kept for back compatibility
    .option('--merge-url <url>', '覆盖 merges 的 URL，请使用 {id} 作为 merge 的 ID')
    .option('--compare-url <url>', '覆盖 URL 进行比较，对 标签(tags) 使用 {from} 和 {to}')
    .option('--issue-pattern <regex>', '覆盖提交消息中 issue 的匹配正则表达式')
    .option('--breaking-pattern <regex>', '正则表达式匹配 breaking change commits')
    .option('--merge-pattern <regex>', '为 merge commits 添加自定义正则表达式来匹配')
    .option('--commit-pattern <regex>', '当解析 commits 时需要包含指定 commit 的表达式')
    .option('--ignore-commit-pattern <regex>', '当解析 commits 时需要忽略指定 commit 的表达式')
    .option('--tag-pattern <regex>', '覆盖 版本标记(tag) 的匹配正则表达式')
    .option('--tag-prefix <prefix>', '版本标记(tag) 中使用的前缀')
    .option('--starting-version <tag>', '指定 changelog 中包含的最早版本')
    .option('--starting-date <yyyy-mm-dd>', '指定 changelog 中包含的最早日期')
    .option('--ending-version <tag>', '指定 changelog 中包含的最新版本')
    .option('--sort-commits <property>', `排序 commits 通过参数 [relevance, date, date-desc]，默认: ${DEFAULT_OPTIONS.sortCommits}`)
    .option('--release-summary', '使用标记的提交消息正文作为发布摘要')
    .option('--unreleased-only', '仅输出未发布的更改')
    .option('--hide-empty-releases', '隐藏空的发布版本')
    .option('--hide-credit', '隐藏 nbc-auto-changelog credit')
    .option('--handlebars-setup <file>', 'handlebars setup file')
    .option('--append-git-log <string>', '要附加到 git log 命令的字符串')
    .option('--append-git-tag <string>', '要附加到 git tag 命令的字符串')
    .option('--prepend', '将 changeLog 添加到输出文件')
    .option('--stdout', '将 changelog 输出到 stdout')
    .option('--plugins [name...]', '使用插件来增加 commit/merge/release 信息')
    .version(version)
    .parse(argv)
    .opts()

  const pkg = await readJson(PACKAGE_FILE)
  const packageOptions = pkg ? pkg[PACKAGE_OPTIONS_KEY] : null
  const dotOptions = await readJson(commandOptions.config || DEFAULT_OPTIONS.config)
  const options = {
    ...DEFAULT_OPTIONS,
    ...dotOptions,
    ...packageOptions,
    ...commandOptions
  }
  const remote = await fetchRemote(options)
  const latestVersion = await getLatestVersion(options)
  if (remote.repoName) {
    options.repoName = remote.repoName
    // options.commitUrl = `https://github.com/${options.repoName}/commit/{id}`
    if (options.template === 'conventional') {
      options.replaceText = {
        "(\\(#(\\d+))\\)" : `[#$2](https://github.com/${options.repoName}/issues/$2)`,
        ...options.replaceText
      }
    }
  }else {
    if (options.template === 'conventional') {
      options.replaceText = {
        "(\\(#(\\d+))\\)" : `[#$2](https://github.com/NiButCrazy/nbc-auto-changelog)`,
        ...options.replaceText
      }
    }
  }
  if (options.template === 'conventional') {
    options.replaceText =
    {
      "([bB]reaking:)": "",
      "([bB]reaking change:)": "",
      "(^[fF]eat:)": "",
      "(^[fF]eat\\((.*?)\\):)": "$2: ",
      "(^[fF]ix:)": "",
      "(^[fF]ix\\((.*?)\\):)": "$2: ",
      "(^[cC]hore:)": "",
      "(^[cC]hore\\((.*?)\\):)": "$2: ",
      "(^[dD]ocs:)": "",
      "(^[dD]ocs\\((.*?)\\):)": "$2: ",
      "(^[rR]efactor:)": "",
      "(^[rR]efactor\\((.*?)\\):)": "$2: ",
      "(^[tT]est:)": "",
      "(^[tT]est\\((.*?)\\):)": "$2: ",
      "(^[sS]tyle:)": "",
      "(^[sS]tyle\\((.*?)\\):)": "$2: ",
      "(^[pP]erf:)": "",
      "(^[pP]erf\\((.*?)\\):)": "$2: ",
      "(^[bB]uild:)": "",
      "(^[bB]uild\\((.*?)\\):)": "$2: ",
      "(^[iI]18n:)": "",
      "(^[iI]18n\\((.*?)\\):)": "$2: ",
      ...options.replaceText
    }
  }
  return {
    ...options,
    ...remote,
    latestVersion,
    plugins: options.plugins.map(p => importCwd(`auto-changelog-${p}`))
  }
}

const getLatestVersion = async options => {
  if (options.latestVersion) {
    return options.latestVersion
  }
  if (options.package) {
    const file = options.package === true ? PACKAGE_FILE : options.package
    if (await fileExists(file) === false) {
      throw new Error(`文件 \x1B[33m${file}\x1B[0m 不存在`)
    }
    const { version } = await readJson(file)
    return version
  }
  return null
}

const run = async argv => {
  const options = await getOptions(argv)
  const log = string => options.stdout ? null : updateLog(string)
  log('抓取标签(tag)中…')
  const tags = await fetchTags(options)
  log(`\x1B[32m${tags.length}\x1B[0m 版本标签(tag)未找到…`)
  const onParsed = ({ title }) => log(`已抓取 \x1B[32m${title}…\x1B[0m`)
  const releases = await parseReleases(tags, options, onParsed)
  const changelog = await compileTemplate(releases, options)
  await write(changelog, options, log)
}

const write = async (changelog, options, log) => {
  if (options.stdout) {
    process.stdout.write(changelog)
    return
  }
  const bytes = formatBytes(Buffer.byteLength(changelog, 'utf8'))
  const existing = await fileExists(options.output) && await readFile(options.output, 'utf8')
  if (existing) {
    const index = options.prepend ? 0 : existing.indexOf(PREPEND_TOKEN)
    if (index !== -1) {
      const prepended = `${changelog}\n${existing.slice(index)}`
      await writeFile(options.output, prepended)
      log(`\x1B[34m${bytes}\x1B[0m 添加至 \x1B[33m${options.output}\x1B[0m\n`)
      return
    }
  }
  await writeFile(options.output, changelog)
  log(`\x1B[34m${bytes}\x1B[0m 已写入 \x1B[33m${options.output}\x1B[0m\n`)
}

module.exports = {
  run
}
