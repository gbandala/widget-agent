import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.ms-powerpoint']
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.xlsx', '.xls', '.pptx', '.ppt', '.docx']

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el límite de 5 MB' }, { status: 400 })
    }

    const name = file.name.toLowerCase()
    const ext = '.' + name.split('.').pop()
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no soportado. Usa PDF, PPTX, PPT, DOCX, TXT o XLSX.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let rawText = ''

    if (ext === '.txt') {
      rawText = buffer.toString('utf-8')
    } else if (ext === '.pdf') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfModule = (await import('pdf-parse')) as any
      const pdfParse = pdfModule.default ?? pdfModule
      const result = await pdfParse(buffer)
      rawText = result.text
    } else if (ext === '.xlsx' || ext === '.xls') {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const parts: string[] = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv.trim()) {
          parts.push(`[Hoja: ${sheetName}]\n${csv}`)
        }
      }
      rawText = parts.join('\n\n')
    } else if (ext === '.docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      rawText = result.value
    } else if (ext === '.ppt') {
      const CFB = await import('cfb')
      const cfb = CFB.read(buffer, { type: 'buffer' })
      const entry = CFB.find(cfb, 'PowerPoint Document')
      if (!entry) throw new Error('No se encontró el stream PowerPoint Document')
      const data = Buffer.from(entry.content as Uint8Array)
      const blocks: string[] = []

      const traverse = (buf: Buffer, start: number, end: number) => {
        let i = start
        while (i < end - 8) {
          const verInst = buf.readUInt16LE(i)
          const recType = buf.readUInt16LE(i + 2)
          const recLen  = buf.readUInt32LE(i + 4)
          if (i + 8 + recLen > end) break
          if ((verInst & 0x0F) === 0x0F) {
            traverse(buf, i + 8, i + 8 + recLen)
          } else if (recType === 0x0FA0) {
            const str = buf.slice(i + 8, i + 8 + recLen).toString('utf16le').replace(/\r/g, '\n').trim()
            const clean = str.replace(/[^\x20-\x7E\xC0-\xFF\xC0-\xFF\n\t]/g, '')
            if (clean.trim().length > 3) blocks.push(clean.trim())
          } else if (recType === 0x0FA1) {
            const str = buf.slice(i + 8, i + 8 + recLen).toString('latin1').replace(/\r/g, '\n').trim()
            if (/[a-zA-Z]{3,}/.test(str) && str.length > 3) blocks.push(str.trim())
          }
          i += 8 + recLen
        }
      }
      traverse(data, 0, data.length)
      rawText = [...new Set(blocks)].join('\n\n')
    } else if (ext === '.pptx') {
      const tmpPath = join(tmpdir(), `kb-upload-${Date.now()}.pptx`)
      try {
        await writeFile(tmpPath, buffer)
        const { parseOffice } = await import('officeparser')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ast = await (parseOffice as any)(tmpPath, { newlineDelimiter: '\n' })
        rawText = typeof ast?.toText === 'function' ? ast.toText() : String(ast)
      } finally {
        await unlink(tmpPath).catch(() => null)
      }
    } else {
      return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })
    }

    rawText = rawText.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim()

    if (rawText.length < 20) {
      return NextResponse.json({ error: 'No se pudo extraer texto del archivo. Verifica que no sea un archivo escaneado o protegido.' }, { status: 422 })
    }

    return NextResponse.json({
      rawText,
      filename: file.name,
      fileType: ext.slice(1),
      charCount: rawText.length,
    })
  } catch (err) {
    console.error('[KB parse-file]', err)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}
