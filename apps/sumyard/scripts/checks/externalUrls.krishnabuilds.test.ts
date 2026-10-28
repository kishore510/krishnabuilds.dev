import { describe, expect, it } from 'vitest'
import { scanText } from './externalUrls'

/* The site links (home and app switcher) put krishnabuilds.dev URLs in the bundle. Only those are allowed. */

const urls = (file: string, text: string) => scanText(file, text).map((f) => f.url)

describe('krishnabuilds.dev links', () => {
  it('allows plain https links to krishnabuilds.dev and one level of subdomain', () => {
    for (const url of [
      'https://krishnabuilds.dev',
      'https://krishnabuilds.dev/',
      'https://chalkline.krishnabuilds.dev',
      'https://sumyard.krishnabuilds.dev/#/c/mortgage',
    ]) {
      expect(scanText('assets/a.js', `{href:\`${url}\`}`), url).toEqual([])
      expect(scanText('index.html', `<a href="${url}">x</a>`), url).toEqual([])
    }
  })

  it('fails krishnabuilds.dev where the browser would fetch it', () => {
    expect(urls('index.html', '<script src="https://krishnabuilds.dev/x.js"></script>')).toEqual(['https://krishnabuilds.dev/x.js'])
    expect(urls('index.html', '<img src="https://sumyard.krishnabuilds.dev/a.png">')).toEqual(['https://sumyard.krishnabuilds.dev/a.png'])
    expect(urls('a.css', 'a{background:url(https://krishnabuilds.dev/x.png)}')).toEqual(['https://krishnabuilds.dev/x.png'])
  })

  it('fails look-alike, nested, insecure and credentialed krishnabuilds.dev hosts', () => {
    for (const url of [
      'http://krishnabuilds.dev',
      'http://sumyard.krishnabuilds.dev',
      'https://krishnabuilds.dev.example.com',
      'https://notkrishnabuilds.dev',
      'https://krishnabuilds.devil.com',
      'https://a.b.krishnabuilds.dev',
      'https://krishnabuilds.dev@example.com',
      'https://krishnabuilds.dev:8080/x',
      'wss://krishnabuilds.dev',
    ]) {
      expect(urls('assets/a.js', `"${url}"`), url).toEqual([url])
    }
  })

  it('still fails every other external URL', () => {
    for (const url of ['https://example.com', 'https://analytics.example.com/collect', 'https://github.com/kishore510']) {
      expect(urls('assets/a.js', `"${url}"`), url).toEqual([url])
    }
  })
})
