import re
import os
import tempfile
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


def browser_executable_path():
    candidates = [
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


def main():
    with tempfile.TemporaryDirectory() as tmp_dir:
      tmp = Path(tmp_dir)
      pdf_file = tmp / "需求说明.pdf"
      jpg_file = tmp / "参考图片.jpg"
      pdf_file.write_bytes(b"%PDF-1.4\nSmoke test file\n")
      jpg_file.write_bytes(b"\xff\xd8\xff\xe0Smoke test image\xff\xd9")

      with sync_playwright() as p:
          executable_path = browser_executable_path()
          browser = p.chromium.launch(
              headless=True,
              executable_path=executable_path,
          )
          context = browser.new_context(accept_downloads=True)
          page = context.new_page()

          page.goto(f"{BASE_URL}/submit")
          page.wait_for_load_state("networkidle")
          expect(page.locator("h1")).to_contain_text("客户需求提交")

          page.fill('input[name="customer_name"]', "自动化测试客户")
          page.fill('input[name="contact"]', "weixin-test-001")
          page.select_option('select[name="task_type"]', label="PPT制作")
          page.fill('input[name="deadline"]', "2026-07-10T18:30")
          page.fill(
              'textarea[name="requirement"]',
              "请制作一份 10 页左右的课程展示 PPT，包含封面、目录、内容页和总结页。",
          )
          page.fill('textarea[name="extra_note"]', "这是自动化验收提交。")
          page.set_input_files('input[name="materials"]', [str(pdf_file), str(jpg_file)])
          page.click('button:has-text("提交需求")')
          page.wait_for_url(re.compile(r".*/submit-success\?orderNo=DD\d{8}\d{3,}"))
          page.wait_for_selector("#successPageOrderNo")

          order_no = page.locator("#successPageOrderNo").inner_text().strip()
          assert re.fullmatch(r"DD\d{8}\d{3,}", order_no), order_no
          expect(page.locator("#successContact")).to_contain_text("weixin-test-001")

          page.click("#successQueryLink")
          page.wait_for_url(f"{BASE_URL}/order-query?orderNo={order_no}")
          expect(page.locator('input[name="order_no"]')).to_have_value(order_no)
          page.fill('input[name="contact"]', "weixin-test-001")
          page.click('#orderQueryForm button[type="submit"]')
          page.wait_for_selector("#orderQueryResult:not(.is-hidden)")
          expect(page.locator("#queryOrderNo")).to_contain_text(order_no)
          expect(page.locator("#queryContact")).to_contain_text("weixin-test-001")

          page.goto(f"{BASE_URL}/admin/login")
          page.wait_for_load_state("networkidle")
          page.fill('input[name="username"]', "admin")
          page.fill('input[name="password"]', "admin123")
          page.click('button:has-text("登录")')
          page.wait_for_url(f"{BASE_URL}/admin")
          page.wait_for_selector("#ordersBody tr")
          expect(page.locator("#ordersBody")).to_contain_text(order_no)

          page.locator(f'tr:has-text("{order_no}") a:has-text("查看")').click()
          page.wait_for_url(re.compile(r".*/admin/orders/\d+$"))
          page.wait_for_load_state("networkidle")
          expect(page.locator("#orderNo")).to_contain_text(order_no)
          expect(page.locator("#fileList")).to_contain_text("需求说明.pdf")
          expect(page.locator("#fileList")).to_contain_text("参考图片.jpg")

          with page.expect_download() as download_info:
              page.locator('a:has-text("需求说明.pdf")').click()
          download = download_info.value
          assert download.suggested_filename == "需求说明.pdf"

          page.select_option("#statusSelect", label="已完成")
          page.fill("#internalNote", "已确认材料，进入处理完成状态。")
          page.click('button:has-text("保存修改")')
          expect(page.locator("#detailMessage")).to_contain_text("保存成功")

          page.goto(f"{BASE_URL}/order-query?orderNo={order_no}")
          page.wait_for_load_state("networkidle")
          page.fill('input[name="contact"]', "weixin-test-001")
          page.click('#orderQueryForm button[type="submit"]')
          page.wait_for_selector("#orderQueryResult:not(.is-hidden)")
          expect(page.locator("#queryStatus")).to_contain_text("已完成")
          assert "已确认材料，进入处理完成状态。" not in page.content()

          page.goto(f"{BASE_URL}/admin/logout")
          page.wait_for_url(f"{BASE_URL}/admin/login")
          page.goto(f"{BASE_URL}/admin")
          page.wait_for_url(f"{BASE_URL}/admin/login")

          browser.close()
          print(f"Smoke test passed. Created order: {order_no}")


if __name__ == "__main__":
    main()
