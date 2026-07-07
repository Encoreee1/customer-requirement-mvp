import os
import re
import time
import urllib.parse
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
    unique_customer = f"V11筛选测试客户{int(time.time())}"
    query = {
        "keyword": unique_customer,
        "status": "未处理",
        "taskType": "课设报告",
        "page": "1",
        "pageSize": "10",
        "sortBy": "deadline",
        "sortOrder": "asc",
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=browser_executable_path(),
        )
        context = browser.new_context()
        page = context.new_page()

        page.goto(f"{BASE_URL}/submit")
        page.wait_for_load_state("networkidle")
        page.fill('input[name="customer_name"]', unique_customer)
        page.fill('input[name="contact"]', "v11-contact-001")
        page.select_option('select[name="task_type"]', label="课设报告")
        page.fill('input[name="deadline"]', "2026-07-07T23:00")
        page.fill("textarea[name=\"requirement\"]", "V1.1 后台筛选验证：今日截止提醒。")
        page.click('button:has-text("提交需求")')
        page.wait_for_selector("#successPanel:not(.is-hidden)")
        order_no = page.locator("#successOrderNo").inner_text().strip()
        assert re.fullmatch(r"DD\d{8}\d{3,}", order_no), order_no

        page.goto(f"{BASE_URL}/admin/login")
        page.wait_for_load_state("networkidle")
        page.fill('input[name="username"]', "admin")
        page.fill('input[name="password"]', "admin123")
        page.click('button:has-text("登录")')
        page.wait_for_url(f"{BASE_URL}/admin")

        page.goto(f"{BASE_URL}/admin?{urllib.parse.urlencode(query)}")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#ordersBody tr")
        expect(page.locator('input[name="keyword"]')).to_have_value(unique_customer)
        expect(page.locator('select[name="status"]')).to_have_value("未处理")
        expect(page.locator('select[name="taskType"]')).to_have_value("课设报告")
        expect(page.locator('select[name="pageSize"]')).to_have_value("10")
        expect(page.locator("#sortSelect")).to_have_value("deadline:asc")
        expect(page.locator("#ordersBody")).to_contain_text(order_no)
        expect(page.locator("#ordersBody .status-badge").first).to_contain_text("未处理")
        assert "status-new" in page.locator("#ordersBody .status-badge").first.get_attribute("class")
        expect(page.locator("#ordersBody .deadline-badge").first).to_contain_text("今日截止")
        expect(page.locator("#ordersSummary")).to_contain_text("共")
        expect(page.locator("#paginationBar")).to_contain_text("第 1 /")

        query.update({"pageSize": "20", "sortBy": "created_at", "sortOrder": "asc"})
        page.goto(f"{BASE_URL}/admin?{urllib.parse.urlencode(query)}")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#ordersBody tr")
        expect(page.locator('select[name="pageSize"]')).to_have_value("20")
        expect(page.locator("#sortSelect")).to_have_value("created_at:asc")
        expect(page.locator("#ordersBody")).to_contain_text(order_no)

        api_response = context.request.get(
            f"{BASE_URL}/api/admin/orders?page=999&pageSize=50&sortBy=deadline&sortOrder=asc"
        )
        assert api_response.ok
        api_data = api_response.json()
        assert api_data["success"] is True
        assert api_data["pagination"]["pageSize"] == 50
        assert api_data["pagination"]["page"] <= api_data["pagination"]["totalPages"]
        assert api_data["sort"] == {"sortBy": "deadline", "sortOrder": "asc"}

        page.locator(f'tr:has-text("{order_no}") a:has-text("查看")').click()
        page.wait_for_url(re.compile(r".*/admin/orders/\d+$"))
        page.wait_for_load_state("networkidle")
        expect(page.locator("#currentStatus .status-badge")).to_contain_text("未处理")
        assert "status-new" in page.locator("#currentStatus .status-badge").get_attribute("class")

        browser.close()
        print(f"V1.1 admin list test passed. Created order: {order_no}")


if __name__ == "__main__":
    main()
