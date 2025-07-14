const { join } = require('path')
const Handlebars = require('handlebars')
const { get } = require('https')
const { readFile, fileExists } = require('./utils')

const TEMPLATES_DIR = join(__dirname, '..', 'templates')
const MATCH_URL = /^https?:\/\/.+/
const COMPILE_OPTIONS = {
  noEscape: true
}

function fetchText (url) {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let data = ''

      // Continuously update stream with data
      response.on('data', (chunk) => {
        data += chunk
      })

      // Resolve once the response is complete
      response.on('end', () => {
        resolve(data)
      })
    }).on('error', reject)
  })
}

Handlebars.registerHelper('json', (object) => {
  return new Handlebars.SafeString(JSON.stringify(object, null, 2))
})

Handlebars.registerHelper('commit-list', (context, options) => {
  if (!context || context.length === 0) {
    return ''
  }

  const { exclude, message, subject, heading } = options.hash

  const list = context
    .filter(item => {
      const commit = item.commit || item
      if (exclude) {
        const pattern = new RegExp(exclude, 'm')
        if (pattern.test(commit.message)) {
          return false
        }
      }
      if (message) {
        const pattern = new RegExp(message, 'm')
        return pattern.test(commit.message)
      }
      if (subject) {
        const pattern = new RegExp(subject)
        return pattern.test(commit.subject)
      }
      return true
    })
    .map(item => options.fn(item))
    .join('')

  if (!list) {
    return ''
  }

  if (!heading) {
    return list
  }

  return `${heading}\n\n${list}`
})

Handlebars.registerHelper('matches', function (val, pattern, options) {
  const r = new RegExp(pattern, options.hash.flags || '')
  return r.test(val) ? options.fn(this) : options.inverse(this)
})

more_detail_regex = /^(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved) +/i
issue_regex = /\(#(\d+)\)/g

let repoName = ''
Handlebars.registerHelper('init', function (data) {
  repoName = data.options.repoName
})

// 作者添加GitHub链接
Handlebars.registerHelper('githubLink', function (auther) {
  let new_auther = auther.split(" ").join("")
  return `[${auther}](https://github.com/${new_auther})`
})
// 美化日期
Handlebars.registerHelper('myDate', function (date) {
  return date.split("-").join("/")
})

// 为详细信息也添加链接
Handlebars.registerHelper('moreDetail', function (message) {
  let detailLines = message.split("\n").filter(line => line.trim() !== '');
  let l = detailLines.length
  let result = ''
  if (l > 1){
    detailLines.shift()
    if (more_detail_regex.test(detailLines[l-2])) {
      detailLines.pop()
    }
    let issue_url = ''
    if (repoName) {
      issue_url = `[#$1](https://github.com/${repoName}/issues/$1)`
    } else {
      issue_url = `[#$1](https://github.com/NiButCrazy/nbc-auto-changelog)`
    }
    detailLines.forEach(line => {
      let new_line = line.replace(issue_regex, issue_url)
      result += `\t-  ${new_line}\n`
    })
    return result
  } else {
    return null
  }
})

// 把所有提交都塞进commits，而不是分开来抽搐
Handlebars.registerHelper('Heading', function (self) {
  if (self.fixes) {
    self.fixes.forEach(fix => {
      self.commits.push(fix.commit)
    })
  }
})

const getTemplate = async template => {
  if (MATCH_URL.test(template)) {
    return await fetchText(template)
  }
  if (await fileExists(template)) {
    return readFile(template)
  }
  const path = join(TEMPLATES_DIR, template + '.hbs')
  if (await fileExists(path) === false) {
    throw new Error(`未找到 \x1B[33m'${template}'\x1B[0m 模板`)
  }
  return readFile(path)
}

const cleanTemplate = template => {
  return template
    // Remove indentation
    .replace(/\n +/g, '\n')
    .replace(/^ +/, '')
    // Fix multiple blank lines
    .replace(/\n\n\n+/g, '\n\n')
    .replace(/\n\n$/, '\n')
}

const compileTemplate = async (releases, options) => {
  const { template, handlebarsSetup } = options
  if (handlebarsSetup) {
    const path = /^\//.test(handlebarsSetup) ? handlebarsSetup : join(process.cwd(), handlebarsSetup)
    const setup = require(path)
    if (typeof setup === 'function') {
      setup(Handlebars)
    }
  }
  const compile = Handlebars.compile(await getTemplate(template), COMPILE_OPTIONS)
  if (template === 'json') {
    return compile({ releases, options })
  }
  return cleanTemplate(compile({ releases, options }))
}

module.exports = {
  compileTemplate
}
