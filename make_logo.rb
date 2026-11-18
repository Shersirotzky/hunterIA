require 'zlib'

w = h = 128
bg = [11, 18, 32]
blue = [56, 189, 248]
purple = [167, 139, 250]
rows = []

h.times do |y|
  row = [0]
  w.times do |x|
    color = bg
    if (x >= 34 && x < 48 && y >= 38 && y < 91) ||
       (x >= 48 && x < 80 && y >= 58 && y < 72) ||
       (x >= 80 && x < 94 && y >= 38 && y < 91)
      color = blue
    elsif (x - 96) ** 2 + (y - 30) ** 2 <= 6 ** 2
      color = purple
    end
    row.concat(color)
  end
  rows << row.pack('C*')
end

def chunk(type, data)
  [data.bytesize].pack('N') + type + data + [Zlib.crc32(type + data)].pack('N')
end

png = "\x89PNG\r\n\x1a\n".b
png << chunk('IHDR', [w, h, 8, 2, 0, 0, 0].pack('NNCCCCC'))
png << chunk('IDAT', Zlib::Deflate.deflate(rows.join))
png << chunk('IEND', ''.b)
File.binwrite('hunter-ia-logo.png', png)
